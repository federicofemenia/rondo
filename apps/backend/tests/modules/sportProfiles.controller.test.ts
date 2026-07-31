import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/app/server.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';
import { seedAuthAdapter } from '../support/seedAuthAdapter.js';

beforeAll(async () => {
  await runSeed();
});

async function deleteProfile(userId: string, sportId: string): Promise<void> {
  const profile = await prisma.userSportProfile.findUnique({ where: { userId_sportId: { userId, sportId } } });
  if (!profile) {
    return;
  }
  await prisma.playerAvailability.deleteMany({ where: { userSportProfileId: profile.id } });
  await prisma.userSportProfile.delete({ where: { id: profile.id } });
}

async function createAnaPadelProfile(app: Awaited<ReturnType<typeof buildServer>>): Promise<void> {
  await app.inject({
    method: 'PUT',
    url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}`,
    headers: { authorization: 'Bearer ana' },
    payload: { positions: [], isAvailableForInvitations: true },
  });
}

describe('GET /api/v1/me/sport-profiles', () => {
  it('returns the sport profiles of the authenticated user, including sport, positions, invitation availability and weekly slots', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/sport-profiles', headers: { authorization: 'Bearer juan' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: Array<{
        sportId: string;
        sportName: string;
        positions: string[];
        isAvailableForInvitations: boolean;
        availability: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }>;
      }>;
    };
    const footballProfile = body.data.find((profile) => profile.sportId === SEED_IDS.sports.football);
    expect(footballProfile).toBeDefined();
    expect(footballProfile?.sportName).toBe('Fútbol');
    expect(footballProfile?.positions).toEqual(['Defensor', 'Mediocampista']);
    expect(footballProfile?.isAvailableForInvitations).toBe(true);
    expect(footballProfile?.availability).toHaveLength(2);

    await app.close();
  });

  it('returns an empty list for a user with no sport profiles', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/sport-profiles', headers: { authorization: 'Bearer ana' } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [] });

    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'GET', url: '/api/v1/me/sport-profiles' });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe('PUT /api/v1/me/sport-profiles/:sportId', () => {
  afterEach(async () => {
    await deleteProfile(SEED_IDS.users.ana, SEED_IDS.sports.padel);
  });

  it('creates a sport profile for the current user', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}`,
      headers: { authorization: 'Bearer ana' },
      payload: { positions: [], isAvailableForInvitations: true },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { sportId: string; positions: string[]; isAvailableForInvitations: boolean; availability: unknown[] } };
    expect(body.data.sportId).toBe(SEED_IDS.sports.padel);
    expect(body.data.positions).toEqual([]);
    expect(body.data.isAvailableForInvitations).toBe(true);
    expect(body.data.availability).toEqual([]);

    await app.close();
  });

  it('updates the existing profile instead of creating a duplicate', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    await createAnaPadelProfile(app);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}`,
      headers: { authorization: 'Bearer ana' },
      payload: { positions: [], isAvailableForInvitations: false },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { isAvailableForInvitations: boolean } };
    expect(body.data.isAvailableForInvitations).toBe(false);

    const profiles = await prisma.userSportProfile.findMany({ where: { userId: SEED_IDS.users.ana, sportId: SEED_IDS.sports.padel } });
    expect(profiles).toHaveLength(1);

    await app.close();
  });

  it('toggles isAvailableForInvitations on and off', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });

    const enabled = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}`,
      headers: { authorization: 'Bearer ana' },
      payload: { positions: [], isAvailableForInvitations: true },
    });
    expect((enabled.json() as { data: { isAvailableForInvitations: boolean } }).data.isAvailableForInvitations).toBe(true);

    const disabled = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}`,
      headers: { authorization: 'Bearer ana' },
      payload: { positions: [], isAvailableForInvitations: false },
    });
    expect((disabled.json() as { data: { isAvailableForInvitations: boolean } }).data.isAvailableForInvitations).toBe(false);

    await app.close();
  });

  it('rejects a nonexistent sport', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: '/api/v1/me/sport-profiles/00000000-0000-0000-0000-000000000000',
      headers: { authorization: 'Bearer ana' },
      payload: { positions: [], isAvailableForInvitations: true },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('SPORT_NOT_FOUND');
    await app.close();
  });

  it('rejects duplicate positions', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.football}`,
      headers: { authorization: 'Bearer ana' },
      payload: { positions: ['Arquero', 'Arquero'], isAvailableForInvitations: true },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects empty position values', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.football}`,
      headers: { authorization: 'Bearer ana' },
      payload: { positions: ['   '], isAvailableForInvitations: true },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}`,
      payload: { positions: [], isAvailableForInvitations: true },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe('PUT /api/v1/me/sport-profiles/:sportId/availability', () => {
  afterEach(async () => {
    await deleteProfile(SEED_IDS.users.ana, SEED_IDS.sports.padel);
  });

  it('saves weekly availability slots for the profile', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    await createAnaPadelProfile(app);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}/availability`,
      headers: { authorization: 'Bearer ana' },
      payload: { slots: [{ dayOfWeek: 6, startMinutes: 14 * 60, endMinutes: 18 * 60 }] },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { availability: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }> } };
    expect(body.data.availability).toHaveLength(1);
    expect(body.data.availability[0]).toMatchObject({ dayOfWeek: 6, startMinutes: 840, endMinutes: 1080 });

    await app.close();
  });

  it('replaces the previous availability entirely', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    await createAnaPadelProfile(app);

    await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}/availability`,
      headers: { authorization: 'Bearer ana' },
      payload: { slots: [{ dayOfWeek: 1, startMinutes: 600, endMinutes: 660 }] },
    });

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}/availability`,
      headers: { authorization: 'Bearer ana' },
      payload: { slots: [{ dayOfWeek: 2, startMinutes: 700, endMinutes: 800 }] },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { availability: Array<{ dayOfWeek: number }> } };
    expect(body.data.availability).toHaveLength(1);
    expect(body.data.availability[0]?.dayOfWeek).toBe(2);

    await app.close();
  });

  it('allows several non-overlapping slots', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    await createAnaPadelProfile(app);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}/availability`,
      headers: { authorization: 'Bearer ana' },
      payload: {
        slots: [
          { dayOfWeek: 1, startMinutes: 600, endMinutes: 660 },
          { dayOfWeek: 1, startMinutes: 700, endMinutes: 800 },
          { dayOfWeek: 3, startMinutes: 600, endMinutes: 660 },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { availability: unknown[] } };
    expect(body.data.availability).toHaveLength(3);

    await app.close();
  });

  it('rejects startMinutes >= endMinutes', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    await createAnaPadelProfile(app);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}/availability`,
      headers: { authorization: 'Bearer ana' },
      payload: { slots: [{ dayOfWeek: 1, startMinutes: 700, endMinutes: 700 }] },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects values outside the 0-1440/0-6 ranges', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    await createAnaPadelProfile(app);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}/availability`,
      headers: { authorization: 'Bearer ana' },
      payload: { slots: [{ dayOfWeek: 7, startMinutes: -10, endMinutes: 1500 }] },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects exact duplicate slots', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    await createAnaPadelProfile(app);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}/availability`,
      headers: { authorization: 'Bearer ana' },
      payload: {
        slots: [
          { dayOfWeek: 6, startMinutes: 600, endMinutes: 660 },
          { dayOfWeek: 6, startMinutes: 600, endMinutes: 660 },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects overlapping slots on the same day', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    await createAnaPadelProfile(app);

    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}/availability`,
      headers: { authorization: 'Bearer ana' },
      payload: {
        slots: [
          { dayOfWeek: 6, startMinutes: 600, endMinutes: 700 },
          { dayOfWeek: 6, startMinutes: 650, endMinutes: 750 },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('returns 404 when the sport profile does not exist yet', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.football}/availability`,
      headers: { authorization: 'Bearer ana' },
      payload: { slots: [] },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe('DELETE /api/v1/me/sport-profiles/:sportId', () => {
  it('deletes a profile and its availability', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    await createAnaPadelProfile(app);
    await app.inject({
      method: 'PUT',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}/availability`,
      headers: { authorization: 'Bearer ana' },
      payload: { slots: [{ dayOfWeek: 6, startMinutes: 600, endMinutes: 660 }] },
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}`,
      headers: { authorization: 'Bearer ana' },
    });

    expect(response.statusCode).toBe(204);

    const profile = await prisma.userSportProfile.findUnique({
      where: { userId_sportId: { userId: SEED_IDS.users.ana, sportId: SEED_IDS.sports.padel } },
    });
    expect(profile).toBeNull();

    await app.close();
  });

  it('returns 404 when deleting a profile that does not exist', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.football}`,
      headers: { authorization: 'Bearer ana' },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });
    const response = await app.inject({ method: 'DELETE', url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.padel}` });

    expect(response.statusCode).toBe(401);
    await app.close();
  });
});

describe('sport profiles are scoped to the authenticated user', () => {
  it("never exposes or mutates another user's sport profile data", async () => {
    const app = await buildServer({ NODE_ENV: 'test' }, { authAdapter: seedAuthAdapter });

    const martinProfiles = await app.inject({ method: 'GET', url: '/api/v1/me/sport-profiles', headers: { authorization: 'Bearer martin' } });
    const martinBody = martinProfiles.json() as { data: Array<{ sportId: string }> };
    expect(martinBody.data.some((profile) => profile.sportId === SEED_IDS.sports.football)).toBe(false);

    // Martin has no football profile of his own, so acting on that sportId under his identity is scoped to him and cannot touch juan's row.
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/me/sport-profiles/${SEED_IDS.sports.football}`,
      headers: { authorization: 'Bearer martin' },
    });
    expect(deleteResponse.statusCode).toBe(404);

    const juanProfile = await prisma.userSportProfile.findUnique({
      where: { userId_sportId: { userId: SEED_IDS.users.juan, sportId: SEED_IDS.sports.football } },
    });
    expect(juanProfile).not.toBeNull();
    expect(juanProfile?.positions).toEqual(['Defensor', 'Mediocampista']);

    await app.close();
  });
});
