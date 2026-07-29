import { describe, expect, it } from 'vitest';
import { buildServer } from '../../src/app/server.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';

describe('GET /api/v1/sports', () => {
  it('returns the seeded sports catalog ordered by displayOrder, with nested modalities also ordered', async () => {
    await runSeed();

    const app = await buildServer({ NODE_ENV: 'test' });
    const response = await app.inject({ method: 'GET', url: '/api/v1/sports' });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: Array<{
        code: string;
        name: string;
        displayOrder: number;
        modalities: Array<{ code: string; name: string; playersCount: number; displayOrder: number }>;
      }>;
    };

    expect(body.data.map((sport) => sport.code)).toEqual(['football', 'padel']);

    const football = body.data.find((sport) => sport.code === 'football');
    expect(football).toMatchObject({ name: 'Fútbol', displayOrder: 1 });
    expect(football?.modalities).toContainEqual(
      expect.objectContaining({ code: 'football-5', name: 'Fútbol 5', playersCount: 10, displayOrder: 1 }),
    );

    const padel = body.data.find((sport) => sport.code === 'padel');
    expect(padel).toMatchObject({ name: 'Pádel', displayOrder: 2 });
    expect(padel?.modalities).toContainEqual(
      expect.objectContaining({ code: 'padel-doubles', name: 'Dobles', playersCount: 4, displayOrder: 1 }),
    );

    await app.close();
  });
});
