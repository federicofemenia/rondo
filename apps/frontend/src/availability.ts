export type AvailabilitySlotDraft = {
  dayOfWeek: number;
  startMinutes: number;
  endMinutes: number;
};

/** dayOfWeek follows the backend convention: 0 = Sunday ... 6 = Saturday (JS Date#getUTCDay()). */
export const WEEKDAY_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
];

export const WEEKDAY_LABELS: Record<number, string> = Object.fromEntries(WEEKDAY_OPTIONS.map((option) => [option.value, option.label]));

function slotsAreDuplicate(a: AvailabilitySlotDraft, b: AvailabilitySlotDraft): boolean {
  return a.dayOfWeek === b.dayOfWeek && a.startMinutes === b.startMinutes && a.endMinutes === b.endMinutes;
}

function slotsOverlap(a: AvailabilitySlotDraft, b: AvailabilitySlotDraft): boolean {
  if (a.dayOfWeek !== b.dayOfWeek) {
    return false;
  }
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

/** Mirrors the backend's duplicate/overlap check so the UI can reject a conflicting slot before it ever reaches the API. */
export function findConflictingSlotIndex(slots: AvailabilitySlotDraft[], candidate: AvailabilitySlotDraft): number | null {
  for (let index = 0; index < slots.length; index += 1) {
    const existing = slots[index]!;
    if (slotsAreDuplicate(existing, candidate) || slotsOverlap(existing, candidate)) {
      return index;
    }
  }
  return null;
}
