/**
 * Rondo only operates in Argentina, which stays at UTC-3 year-round (no
 * DST) -- so every "local minutes of day" computation can use one fixed
 * offset instead of a full timezone database. startsAt/endsAt are stored as
 * real UTC instants; organizers always pick/see Argentina wall-clock time,
 * so any comparison against a wall-clock concept (availability windows,
 * weekly availability slots) must go through here first instead of reading
 * getUTCHours()/getUTCMinutes() directly.
 */
export const ARGENTINA_UTC_OFFSET_MINUTES = 180;

/** Converts a real UTC instant into its Argentina wall-clock minutes-of-day (0-1439). */
export function toArgentinaMinutesOfDay(date: Date): number {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  return (((utcMinutes - ARGENTINA_UTC_OFFSET_MINUTES) % 1440) + 1440) % 1440;
}

/**
 * Builds the real UTC instant for `minutesFromMidnight` Argentina local time
 * on `scheduledDate` (a bare calendar day stored as literal UTC midnight,
 * e.g. from Match.scheduledDate). Mirrors the frontend's buildIsoDateTime
 * (scheduleFormat.ts) so both sides agree on what a given day+minutes pair
 * actually means as an instant.
 */
export function toArgentinaInstant(scheduledDate: Date, minutesFromMidnight: number): Date {
  return new Date(scheduledDate.getTime() + (minutesFromMidnight + ARGENTINA_UTC_OFFSET_MINUTES) * 60_000);
}
