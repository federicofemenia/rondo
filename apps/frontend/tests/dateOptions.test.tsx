import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDayOptions } from '../src/dateOptions';

function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

describe('buildDayOptions', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps "Hoy" pinned to the local calendar day late at night, even when that instant has already rolled to the next UTC day', () => {
    // 23:30 local time -- for any UTC-negative timezone (e.g. Argentina,
    // UTC-3) this instant is already tomorrow in UTC. The "value" must
    // still be today's local date, matching the "Hoy" label.
    const lateLocal = new Date();
    lateLocal.setHours(23, 30, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(lateLocal);

    const [today] = buildDayOptions(1);

    expect(today!.value).toBe(localDateString(lateLocal));
  });

  it('advances by exactly one local calendar day per option', () => {
    const noonLocal = new Date();
    noonLocal.setHours(12, 0, 0, 0);
    vi.useFakeTimers();
    vi.setSystemTime(noonLocal);

    const options = buildDayOptions(3);

    const expectedDates = [0, 1, 2].map((offset) => {
      const date = new Date(noonLocal);
      date.setDate(date.getDate() + offset);
      return localDateString(date);
    });

    expect(options.map((option) => option.value)).toEqual(expectedDates);
  });
});
