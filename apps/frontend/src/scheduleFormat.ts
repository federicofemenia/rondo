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

/** Reads the UTC time-of-day portion of an ISO instant as "HH:MM". */
export function formatIsoTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

/** Reads the UTC time-of-day portion of an ISO instant as minutes since midnight. */
export function isoTimeToMinutes(iso: string): number {
  const date = new Date(iso);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
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

export type ScheduleUpdateInput = {
  scheduledDate: string;
  availabilityStartMinutes: number;
  availabilityEndMinutes: number;
  startsAt: string | null;
};

/** Builds the UTC ISO instant for `minutesFromMidnight` on the given YYYY-MM-DD day. */
export function buildIsoDateTime(scheduledDate: string, minutesFromMidnight: number): string {
  const date = new Date(`${scheduledDate}T00:00:00.000Z`);
  date.setUTCMinutes(date.getUTCMinutes() + minutesFromMidnight);
  return date.toISOString();
}
