import type { MatchVenueTypeDto } from '@rondo/contracts';

// Rondo only operates in Argentina, which stays at UTC-3 year-round (no
// DST) -- startsAt/endsAt travel the wire as real UTC instants, but every
// hour the organizer picks or sees is Argentina wall-clock time, so
// conversion always goes through this fixed offset instead of relying on
// the browser's own timezone (which may not match the user's real one).
const ARGENTINA_UTC_OFFSET_MINUTES = 180;

const dateLabelFormatter = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** Capitalized day label, e.g. "Sábado 8 de agosto", from a YYYY-MM-DD date. */
export function formatScheduledDateLabel(scheduledDate: string): string {
  const date = new Date(`${scheduledDate}T00:00:00.000Z`);
  const label = dateLabelFormatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatMinutesAsTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** Parses an "HH:MM" string into minutes since midnight, e.g. "18:30" -> 1110. */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/** Reads the Argentina wall-clock time-of-day portion of an ISO instant as minutes since midnight. */
export function isoTimeToMinutes(iso: string): number {
  const date = new Date(iso);
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (((utcMinutes - ARGENTINA_UTC_OFFSET_MINUTES) % 1440) + 1440) % 1440;
}

/** Reads the Argentina wall-clock time-of-day portion of an ISO instant as "HH:MM". */
export function formatIsoTime(iso: string): string {
  return formatMinutesAsTime(isoTimeToMinutes(iso));
}

export function formatAvailabilityWindow(availabilityStartMinutes: number, availabilityEndMinutes: number): string {
  return `${formatMinutesAsTime(availabilityStartMinutes)}–${formatMinutesAsTime(availabilityEndMinutes)}`;
}

export type MatchSchedule = {
  scheduledDate: string;
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  startsAt: string | null;
  endsAt: string | null;
};

export type ScheduleDescription = {
  dateLabel: string;
  windowLabel: string;
  timeLabel: string;
  isConfirmed: boolean;
};

/** Centralizes how a match schedule (confirmed or pending) is described across Home and Match Detail. */
export function describeSchedule(match: MatchSchedule): ScheduleDescription {
  const dateLabel = formatScheduledDateLabel(match.scheduledDate);
  const windowLabel = formatAvailabilityWindow(match.availabilityStartMinutes, match.availabilityEndMinutes);

  if (match.startsAt && match.endsAt) {
    return { dateLabel, windowLabel, timeLabel: `${formatIsoTime(match.startsAt)} a ${formatIsoTime(match.endsAt)}`, isConfirmed: true };
  }

  return { dateLabel, windowLabel, timeLabel: 'Horario a confirmar', isConfirmed: false };
}

const EXACT_TIME_LATEST_START_MINUTES = 23 * 60;
const EXACT_TIME_EARLIEST_FUTURE_START_MINUTES = 10 * 60;
const EXACT_TIME_STEP_MINUTES = 30;

/**
 * Bounds for the "horario exacto" picker: today only allows times from now
 * (rounded up to the next half hour) through 23:00; any later day allows
 * the full 10:00-23:00 window, since there's no "already passed" concern.
 */
export function computeExactTimeBounds(isToday: boolean): [number, number] {
  if (!isToday) {
    return [EXACT_TIME_EARLIEST_FUTURE_START_MINUTES, EXACT_TIME_LATEST_START_MINUTES];
  }

  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const nowLocalMinutes = (((utcMinutes - ARGENTINA_UTC_OFFSET_MINUTES) % 1440) + 1440) % 1440;
  const startMinutes = Math.min(
    Math.ceil(nowLocalMinutes / EXACT_TIME_STEP_MINUTES) * EXACT_TIME_STEP_MINUTES,
    EXACT_TIME_LATEST_START_MINUTES,
  );
  return [startMinutes, EXACT_TIME_LATEST_START_MINUTES];
}

export type ScheduleUpdateInput = {
  venueType: MatchVenueTypeDto;
  clubId: string | null;
  customVenueName: string | null;
  scheduledDate: string;
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  durationMinutes: number;
  startsAt: string | null;
};

/** Builds the true UTC ISO instant for `minutesFromMidnight` Argentina local time on the given YYYY-MM-DD day. */
export function buildIsoDateTime(scheduledDate: string, minutesFromMidnight: number): string {
  const date = new Date(`${scheduledDate}T00:00:00.000Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutesFromMidnight + ARGENTINA_UTC_OFFSET_MINUTES);
  return date.toISOString();
}
