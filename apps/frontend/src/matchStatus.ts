import type { MatchStatusDto } from '@rondo/contracts';
import type { MatchEntity } from './types';

export const MATCH_STATUS_LABELS: Record<MatchStatusDto, string> = {
  ORGANIZING: 'Organizando',
  FULL: 'Completo',
  IN_PROGRESS: 'En juego',
  COMPLETED: 'Finalizado',
  CANCELLED: 'Cancelado',
  EXPIRED: 'Vencido',
};

export const MATCH_STATUS_CHIP_STYLES: Record<MatchStatusDto, { bgcolor: string; color: string }> = {
  ORGANIZING: { bgcolor: 'rgba(245, 197, 66, 0.16)', color: 'warning.main' },
  FULL: { bgcolor: 'rgba(46, 204, 113, 0.16)', color: 'primary.light' },
  IN_PROGRESS: { bgcolor: 'rgba(77, 163, 255, 0.16)', color: 'info.main' },
  COMPLETED: { bgcolor: 'background.default', color: 'text.secondary' },
  CANCELLED: { bgcolor: 'rgba(255, 77, 79, 0.16)', color: 'error.main' },
  EXPIRED: { bgcolor: 'background.default', color: 'text.secondary' },
};

const RATINGS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const HOME_VISIBILITY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isMatchFull(match: MatchEntity): boolean {
  const max = Number(match.maxPlayers);
  return Number.isFinite(max) && max > 0 && match.participants.length >= max;
}

type MatchWindow = { start: Date; end: Date };

function parseMatchWindow(match: MatchEntity): MatchWindow | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(match.date)) {
    return null;
  }

  let startTime = '00:00';
  let endTime = '23:59';

  if (match.time) {
    const parts = match.time.split(' - ').map((part) => part.trim());
    if (parts[0] && /^\d{2}:\d{2}$/.test(parts[0])) {
      startTime = parts[0];
    }
    const last = parts[parts.length - 1];
    if (last && /^\d{2}:\d{2}$/.test(last)) {
      endTime = last;
    }
  }

  const start = new Date(`${match.date}T${startTime}:00`);
  const end = new Date(`${match.date}T${endTime}:00`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  return { start, end };
}

export function isMatchFinished(match: MatchEntity, now: Date = new Date()): boolean {
  const window = parseMatchWindow(match);
  return window !== null && now.getTime() >= window.end.getTime();
}

/**
 * Centralizes every time-based (and cancellation-based) match status rule in
 * one place, mirroring the backend's resolveMatchStatus, adapted to this
 * prototype's fuzzy "day + estimated time range" model instead of concrete
 * startsAt/endsAt timestamps. Nothing else in the app should compare
 * match.date/match.time against `now` directly.
 */
export function resolveMatchStatus(match: MatchEntity, now: Date = new Date()): MatchStatusDto {
  if (match.cancelledAt) {
    return 'CANCELLED';
  }

  const window = parseMatchWindow(match);
  const full = isMatchFull(match);

  if (window && now.getTime() >= window.end.getTime()) {
    return full ? 'COMPLETED' : 'EXPIRED';
  }

  if (!full) {
    return 'ORGANIZING';
  }

  if (window && now.getTime() >= window.start.getTime()) {
    return 'IN_PROGRESS';
  }

  return 'FULL';
}

export function ratingsCloseAt(match: MatchEntity): Date | null {
  const window = parseMatchWindow(match);
  if (!window) {
    return null;
  }
  return new Date(window.end.getTime() + RATINGS_WINDOW_MS);
}

export function isRatingsOpen(match: MatchEntity, now: Date = new Date()): boolean {
  if (resolveMatchStatus(match, now) !== 'COMPLETED') {
    return false;
  }
  const closeAt = ratingsCloseAt(match);
  return closeAt !== null && now.getTime() < closeAt.getTime();
}

export function isVisibleOnHome(match: MatchEntity, now: Date = new Date()): boolean {
  const status = resolveMatchStatus(match, now);

  if (status === 'ORGANIZING' || status === 'FULL' || status === 'IN_PROGRESS') {
    return true;
  }

  if (status === 'CANCELLED') {
    if (!match.cancelledAt) {
      return true;
    }
    return now.getTime() - new Date(match.cancelledAt).getTime() < HOME_VISIBILITY_WINDOW_MS;
  }

  const window = parseMatchWindow(match);
  if (!window) {
    return true;
  }
  return now.getTime() - window.end.getTime() < HOME_VISIBILITY_WINDOW_MS;
}
