import { createFakeAuthAdapter } from './fakeAuthAdapter.js';

/**
 * Fake auth adapter whose profiles match the seeded demo users' clerkUserId
 * and email exactly, so syncUserFromClerk resolves to the same deterministic
 * SEED_IDS.users.* rows created by runSeed() instead of creating new ones.
 */
export const seedAuthAdapter = createFakeAuthAdapter({
  juan: { clerkUserId: 'seed_juan_perez', email: 'juan.perez.seed@rondo.local', firstName: 'Juan', lastName: 'Pérez', avatarUrl: null },
  martin: { clerkUserId: 'seed_martin_gomez', email: 'martin.gomez.seed@rondo.local', firstName: 'Martín', lastName: 'Gómez', avatarUrl: null },
  luciano: { clerkUserId: 'seed_luciano_diaz', email: 'luciano.diaz.seed@rondo.local', firstName: 'Luciano', lastName: 'Díaz', avatarUrl: null },
  ana: { clerkUserId: 'seed_ana_torres', email: 'ana.torres.seed@rondo.local', firstName: 'Ana', lastName: 'Torres', avatarUrl: null },
});
