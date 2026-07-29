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

export const timeRangeOptions = ['13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00', '17:00 - 18:00'];
