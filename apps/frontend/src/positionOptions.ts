const POSITION_OPTIONS_BY_SPORT: Record<string, string[]> = {
  Fútbol: ['Arquero', 'Defensor', 'Mediocampista', 'Delantero'],
};

/** Position choices offered in the sport-profile editor. Sports without a known catalog (e.g. Pádel) return none. */
export function getPositionOptions(sportName: string): string[] {
  return POSITION_OPTIONS_BY_SPORT[sportName] ?? [];
}
