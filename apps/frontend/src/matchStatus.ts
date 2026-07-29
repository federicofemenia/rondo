import type { MatchEntity } from './types';

export function isMatchFull(match: MatchEntity): boolean {
  const max = Number(match.maxPlayers);
  return Number.isFinite(max) && max > 0 && match.participants.length >= max;
}

function parseMatchDeadline(match: MatchEntity): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(match.date)) {
    return null;
  }

  let endTime = '23:59';
  if (match.time) {
    const parts = match.time.split(' - ');
    const last = parts[parts.length - 1]!.trim();
    if (/^\d{2}:\d{2}$/.test(last)) {
      endTime = last;
    }
  }

  const deadline = new Date(`${match.date}T${endTime}:00`);
  return Number.isNaN(deadline.getTime()) ? null : deadline;
}

export function isMatchFinished(match: MatchEntity, now: Date = new Date()): boolean {
  const deadline = parseMatchDeadline(match);
  return deadline !== null && now.getTime() >= deadline.getTime();
}
