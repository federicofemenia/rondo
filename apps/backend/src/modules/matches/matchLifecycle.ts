import type { Match, MatchStatus } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.js';

const TERMINAL_STATUSES: readonly MatchStatus[] = ['COMPLETED', 'CANCELLED', 'EXPIRED'];

export const HOME_VISIBILITY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const RATINGS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

type LifecycleMatch = Pick<Match, 'status' | 'startsAt' | 'endsAt'>;

/**
 * Pure time-based transition table. Participant-count-driven transitions
 * (ORGANIZING <-> FULL) are applied wherever participants change, not here.
 */
export function resolveMatchStatus(match: LifecycleMatch, now: Date): MatchStatus {
  if (TERMINAL_STATUSES.includes(match.status)) {
    return match.status;
  }

  const nowMs = now.getTime();
  const startsAtMs = match.startsAt.getTime();
  const endsAtMs = match.endsAt.getTime();

  if (match.status === 'ORGANIZING') {
    return nowMs >= endsAtMs ? 'EXPIRED' : 'ORGANIZING';
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
export async function applyMatchLifecycle<T extends Match>(match: T, now: Date = new Date()): Promise<T> {
  const resolvedStatus = resolveMatchStatus(match, now);
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

export function ratingsCloseAt(match: Pick<Match, 'endsAt'>): Date {
  return new Date(match.endsAt.getTime() + RATINGS_WINDOW_MS);
}

export function isRatingsEnabled(match: Pick<Match, 'status'>): boolean {
  return match.status === 'COMPLETED';
}

export function isRatingsOpen(match: Pick<Match, 'status' | 'endsAt'>, now: Date = new Date()): boolean {
  return isRatingsEnabled(match) && now.getTime() < ratingsCloseAt(match).getTime();
}

export function isVisibleOnHome(match: Pick<Match, 'status' | 'endsAt' | 'statusChangedAt'>, now: Date = new Date()): boolean {
  const nowMs = now.getTime();

  switch (match.status) {
    case 'ORGANIZING':
    case 'FULL':
    case 'IN_PROGRESS':
      return true;
    case 'CANCELLED':
      return nowMs - match.statusChangedAt.getTime() < HOME_VISIBILITY_WINDOW_MS;
    case 'COMPLETED':
    case 'EXPIRED':
      return nowMs - match.endsAt.getTime() < HOME_VISIBILITY_WINDOW_MS;
    default:
      return true;
  }
}
