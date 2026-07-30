import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/app/server.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';
import { seedAuthAdapter } from '../support/seedAuthAdapter.js';
import { createTestMatch, deleteTestMatch } from '../support/matchFactory.js';

beforeAll(async () => {
  await runSeed();
});

const createdMatchIds: string[] = [];

afterEach(async () => {
  await Promise.all(createdMatchIds.splice(0).map(deleteTestMatch));
});

async function completedMatch(overrides: Parameters<typeof createTestMatch>[0] = {}) {
  const now = Date.now();
  const match = await createTestMatch({
    organizerUserId: SEED_IDS.users.juan,
    participantUserIds: [SEED_IDS.users.juan, SEED_IDS.users.martin, SEED_IDS.users.luciano],
    status: 'COMPLETED',
    endsAt: new Date(now - 2 * 3600_000),
    statusChangedAt: new Date(now - 2 * 3600_000),
    ...overrides,
  });
  createdMatchIds.push(match.id);
  return match;
}

describe('GET /api/v1/me/pending-tasks', () => {
  it('shows the correct pending count for a completed match', async () => {
    const match = await completedMatch();

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/pending-tasks', headers: { authorization: 'Bearer juan' } });
    const tasks = (response.json() as { data: Array<{ matchId: string; pendingCount: number; targetTab: string }> }).data;
    const task = tasks.find((item) => item.matchId === match.id);

    expect(task).toBeTruthy();
    expect(task?.pendingCount).toBe(2);
    expect(task?.targetTab).toBe('ratings');

    await app.close();
  });

  it('the task disappears once the user has rated every pending participant', async () => {
    const match = await completedMatch();
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });

    await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.martin}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 4, conductScore: 4 },
    });
    await app.inject({
      method: 'PUT',
      url: `/api/v1/matches/${match.id}/ratings/${SEED_IDS.users.luciano}`,
      headers: { authorization: 'Bearer juan' },
      payload: { gameplayScore: 4, conductScore: 4 },
    });

    const response = await app.inject({ method: 'GET', url: '/api/v1/me/pending-tasks', headers: { authorization: 'Bearer juan' } });
    const tasks = (response.json() as { data: Array<{ matchId: string }> }).data;

    expect(tasks.some((item) => item.matchId === match.id)).toBe(false);

    await app.close();
  });

  it('the task disappears once the ratings window has closed', async () => {
    const match = await completedMatch({
      endsAt: new Date(Date.now() - 8 * 24 * 3600_000),
      statusChangedAt: new Date(Date.now() - 8 * 24 * 3600_000),
    });

    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/pending-tasks', headers: { authorization: 'Bearer juan' } });
    const tasks = (response.json() as { data: Array<{ matchId: string }> }).data;

    expect(tasks.some((item) => item.matchId === match.id)).toBe(false);

    await app.close();
  });
});
