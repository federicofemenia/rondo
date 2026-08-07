import { createFakeAuthAdapter } from './fakeAuthAdapter.js';

/**
 * Fake auth adapter whose fixtures match the seeded demo users' usernames
 * exactly (see seed.ts), so tests resolve to the same deterministic
 * SEED_IDS.users.* rows created by runSeed() instead of creating new ones.
 */
export const seedAuthAdapter = createFakeAuthAdapter({
  juan: { username: 'juan_perez_demo', displayName: 'Juan Pérez' },
  martin: { username: 'martin_gomez_demo', displayName: 'Martín Gómez' },
  luciano: { username: 'luciano_diaz_demo', displayName: 'Luciano Díaz' },
  ana: { username: 'ana_torres_demo', displayName: 'Ana Torres' },
});
