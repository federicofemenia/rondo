export function calculateAge(birthDate: string, now: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return null;
  }
  const [year, month, day] = birthDate.split('-').map(Number) as [number, number, number];
  const birth = new Date(year, month - 1, day);
  if (Number.isNaN(birth.getTime())) {
    return null;
  }
  let age = now.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }
  return age;
}
