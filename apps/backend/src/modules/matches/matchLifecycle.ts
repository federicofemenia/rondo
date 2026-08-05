import type { Match, MatchStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';
import { toArgentinaInstant } from './argentinaTime.js';

const TERMINAL_STATUSES: readonly MatchStatus[] = ['COMPLETED', 'CANCELLED', 'EXPIRED'];

export const HOME_VISIBILITY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RATINGS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const CHAT_POST_MATCH_WINDOW_MS = 24 * 60 * 60 * 1000;

const CHAT_WRITABLE_STATUSES: readonly MatchStatus[] = ['ORGANIZING', 'FULL', 'IN_PROGRESS', 'COMPLETED'];

type LifecycleMatch = Pick<Match, 'status' | 'scheduledDate' | 'availabilityStartMinutes' | 'startsAt' | 'endsAt' | 'minPlayers'>;

/** Midnight (UTC) of the day after `date`, i.e. the exclusive end of that calendar day. */
export function endOfScheduledDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1, 0, 0, 0, 0));
}

/**
 * The instant a franja-only match (no confirmed startsAt) expires: the
 * moment its proposed availability window *starts*, in Argentina local
 * time -- not when it ends, and not end-of-day. If the organizer hasn't
 * locked in an exact time before the window they proposed even begins,
 * there's no reason for players to expect the match still might happen.
 */
export function rangeStartAt(match: Pick<Match, 'scheduledDate' | 'availabilityStartMinutes'>): Date {
  return toArgentinaInstant(match.scheduledDate, match.availabilityStartMinutes);
}

/**
 * Pure time-based transition table. Participant-count-driven transitions
 * (ORGANIZING <-> FULL) are applied wherever participants change, not here.
 * A match without a confirmed time (startsAt/endsAt still null) never
 * starts or completes automatically: it stays ORGANIZING/FULL until either
 * a time is set, or its proposed availability window starts (rangeStartAt),
 * at which point it expires -- it never lingers all the way to end-of-day.
 *
 * An ORGANIZING match that never reaches maxPlayers still counts as played
 * once it has at least minPlayers confirmed: it rides the same clock as a
 * FULL match (IN_PROGRESS at startsAt, COMPLETED at endsAt) instead of just
 * expiring, so ratings can open for it. Below minPlayers it still expires at
 * endsAt as before.
 */
export function resolveMatchStatus(match: LifecycleMatch, participantsCount: number, now: Date): MatchStatus {
  if (TERMINAL_STATUSES.includes(match.status)) {
    return match.status;
  }

  if (!match.startsAt || !match.endsAt) {
    return now.getTime() >= rangeStartAt(match).getTime() ? 'EXPIRED' : match.status;
  }

  const nowMs = now.getTime();
  const startsAtMs = match.startsAt.getTime();
  const endsAtMs = match.endsAt.getTime();

  if (match.status === 'ORGANIZING') {
    if (participantsCount < match.minPlayers) {
      return nowMs >= endsAtMs ? 'EXPIRED' : 'ORGANIZING';
    }
    if (nowMs >= endsAtMs) return 'COMPLETED';
    if (nowMs >= startsAtMs) return 'IN_PROGRESS';
    return 'ORGANIZING';
  }

  if (match.status === 'FULL') {
    if (nowMs >= endsAtMs) return 'COMPLETED';
    if (nowMs >= startsAtMs) return 'IN_PROGRESS';
    return 'FULL';
  }

  if (match.status === 'IN_PROGRESS') {
    return nowMs >= endsAtMs ? 'COMPLETED' : 'IN_PROGRESS';
  }

  return match.status;
}

/**
 * Resolves the current match lifecycle and persists the transition when it
 * changed. Idempotent: calling it repeatedly with the same or a later `now`
 * converges and stops mutating once a terminal status is reached.
 */
export async function applyMatchLifecycle<T extends Match>(match: T, participantsCount: number, now: Date = new Date()): Promise<T> {
  const resolvedStatus = resolveMatchStatus(match, participantsCount, now);
  if (resolvedStatus === match.status) {
    return match;
  }

  const updated = await prisma.match.update({
    where: { id: match.id },
    data: {
      status: resolvedStatus,
      statusChangedAt: now,
      statusChangedByType: 'SYSTEM',
      statusChangedByUserId: null,
    },
  });

  return { ...match, ...updated };
}

export function ratingsCloseAt(match: Pick<Match, 'endsAt'>): Date | null {
  if (!match.endsAt) {
    return null;
  }
  return new Date(match.endsAt.getTime() + RATINGS_WINDOW_MS);
}

export function isRatingsEnabled(match: Pick<Match, 'status'>): boolean {
  return match.status === 'COMPLETED';
}

export function isRatingsOpen(match: Pick<Match, 'status' | 'endsAt'>, now: Date = new Date()): boolean {
  const closeAt = ratingsCloseAt(match);
  return isRatingsEnabled(match) && closeAt !== null && now.getTime() < closeAt.getTime();
}

/**
 * The match chat accepts new messages while the match is active (ORGANIZING,
 * FULL, IN_PROGRESS), and for a 24h grace window after it completes.
 * Cancelled and expired matches close the chat immediately — history stays
 * readable, but nothing new can be posted.
 */
export function canSendMatchChatMessage(match: Pick<Match, 'status' | 'endsAt'>, now: Date = new Date()): boolean {
  if (!CHAT_WRITABLE_STATUSES.includes(match.status)) {
    return false;
  }
  if (match.status !== 'COMPLETED') {
    return true;
  }
  // endsAt is guaranteed once a match reaches COMPLETED (see resolveMatchStatus).
  return match.endsAt !== null && now.getTime() - match.endsAt.getTime() < CHAT_POST_MATCH_WINDOW_MS;
}

/** When a COMPLETED match's chat will close, or null if it isn't on that timer. */
export function matchChatClosesAt(match: Pick<Match, 'status' | 'endsAt'>): Date | null {
  if (match.status !== 'COMPLETED' || !match.endsAt) {
    return null;
  }
  return new Date(match.endsAt.getTime() + CHAT_POST_MATCH_WINDOW_MS);
}

export function isVisibleOnHome(
  match: Pick<Match, 'status' | 'scheduledDate' | 'availabilityStartMinutes' | 'endsAt' | 'statusChangedAt'>,
  now: Date = new Date(),
): boolean {
  const nowMs = now.getTime();

  switch (match.status) {
    case 'ORGANIZING':
    case 'FULL':
    case 'IN_PROGRESS':
      return true;
    case 'CANCELLED':
      return nowMs - match.statusChangedAt.getTime() < HOME_VISIBILITY_WINDOW_MS;
    case 'COMPLETED':
    case 'EXPIRED': {
      const referenceMs = match.endsAt ? match.endsAt.getTime() : rangeStartAt(match).getTime();
      return nowMs - referenceMs < HOME_VISIBILITY_WINDOW_MS;
    }
    default:
      return true;
  }
}
