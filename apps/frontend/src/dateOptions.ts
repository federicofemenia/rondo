export type DayOption = {
  value: string;
  label: string;
};

const weekdayFormatter = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

export function buildDayOptions(count = 10): DayOption[] {
  const options: DayOption[] = [];
  for (let i = 0; i < count; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const value = date.toISOString().slice(0, 10);
    const formatted = weekdayFormatter.format(date);
    const label = i === 0 ? `Hoy • ${formatted}` : i === 1 ? `Mañana • ${formatted}` : formatted;
    options.push({ value, label });
  }
  return options;
}

export type TimeRangeOption = {
  value: string;
  label: string;
};

export const timeRangeOptions: TimeRangeOption[] = [
  { value: '10:00 - 13:00', label: 'Mañana (10:00 - 13:00)' },
  { value: '13:00 - 19:00', label: 'Tarde (13:00 - 19:00)' },
  { value: '20:00 - 24:00', label: 'Noche (20:00 - 24:00)' },
];
