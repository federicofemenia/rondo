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
