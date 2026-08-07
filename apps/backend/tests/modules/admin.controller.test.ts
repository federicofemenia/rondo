import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/app/server.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runSeed } from '../../src/infrastructure/database/seed.js';
import { SEED_IDS } from '../../src/infrastructure/database/seedIds.js';
import { createFakeAuthAdapter } from '../support/fakeAuthAdapter.js';

const authAdapter = createFakeAuthAdapter({
  juan: { username: 'juan_perez_demo', displayName: 'Juan Pérez' },
  martin: { username: 'martin_gomez_demo', displayName: 'Martín Gómez' },
  luciano: { username: 'luciano_diaz_demo', displayName: 'Luciano Díaz' },
  ana: { username: 'ana_torres_demo', displayName: 'Ana Torres' },
  camila: { username: 'camila_ruiz_demo', displayName: 'Camila Ruiz' },
});

// Test-only role/membership fixture, layered on top of the shared seed:
// camila is promoted to global SUPERADMIN, juan becomes Señor Pato's
// CLUB_ADMIN, and a second club ("Otro Club") is created with luciano as its
// sole CLUB_ADMIN, so tests can exercise "administers club A but not club B"
// without inventing a whole new seed. Everything here is reverted in
// afterAll so later test files see the seed exactly as seed.ts left it.
let otherClubId: string;

async function buildApp() {
  return buildServer({ NODE_ENV: 'test' }, { authAdapter });
}

beforeAll(async () => {
  await runSeed();

  await prisma.user.update({ where: { id: SEED_IDS.users.camila }, data: { role: 'SUPERADMIN' } });

  await prisma.clubMembership.upsert({
    where: { clubId_userId: { clubId: SEED_IDS.club.senorPato, userId: SEED_IDS.users.juan } },
    update: { role: 'CLUB_ADMIN', status: 'ACTIVE' },
    create: { clubId: SEED_IDS.club.senorPato, userId: SEED_IDS.users.juan, role: 'CLUB_ADMIN', status: 'ACTIVE' },
  });

  const otherClub = await prisma.club.create({
    data: { code: 'test-otro-club', name: 'Otro Club de Prueba', timezone: 'America/Argentina/Buenos_Aires' },
  });
  otherClubId = otherClub.id;

  await prisma.clubMembership.create({
    data: { clubId: otherClubId, userId: SEED_IDS.users.luciano, role: 'CLUB_ADMIN', status: 'ACTIVE' },
  });
});

afterAll(async () => {
  await prisma.clubMembership.deleteMany({ where: { clubId: otherClubId } });
  await prisma.court.deleteMany({ where: { clubId: otherClubId } });
  await prisma.club.delete({ where: { id: otherClubId } });
  await prisma.clubMembership.deleteMany({ where: { clubId: SEED_IDS.club.senorPato, userId: SEED_IDS.users.juan } });
  await prisma.user.update({ where: { id: SEED_IDS.users.camila }, data: { role: 'USER' } });
});

describe('GET /api/v1/admin/clubs', () => {
  it('returns every club for a SUPERADMIN', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/clubs', headers: { authorization: 'Bearer camila' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ id: string; myRole: string }> };
    expect(body.data.map((club) => club.id)).toContain(SEED_IDS.club.senorPato);
    expect(body.data.map((club) => club.id)).toContain(otherClubId);
    expect(body.data.find((club) => club.id === SEED_IDS.club.senorPato)?.myRole).toBe('SUPERADMIN');

    await app.close();
  });

  it('returns only the clubs a CLUB_ADMIN actively administers', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/clubs', headers: { authorization: 'Bearer juan' } });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ id: string; myRole: string; courtsCount: number }> };
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({ id: SEED_IDS.club.senorPato, myRole: 'CLUB_ADMIN' });
    expect(body.data[0]?.courtsCount).toBeGreaterThan(0);

    await app.close();
  });

  it('returns an empty list for a plain member with no admin access anywhere', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/admin/clubs', headers: { authorization: 'Bearer martin' } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [] });

    await app.close();
  });
});

describe('POST /api/v1/admin/clubs', () => {
  it('lets a SUPERADMIN create a club with a generated code and ACTIVE status', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/clubs',
      headers: { authorization: 'Bearer camila' },
      payload: { name: 'Club Nuevo Test', city: 'CABA' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { data: { id: string; name: string; city: string; isActive: boolean } };
    expect(body.data.name).toBe('Club Nuevo Test');
    expect(body.data.city).toBe('CABA');
    expect(body.data.isActive).toBe(true);

    await prisma.club.delete({ where: { id: body.data.id } });
    await app.close();
  });

  it('rejects a non-superadmin (CLUB_ADMIN of an existing club) with 403', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/clubs',
      headers: { authorization: 'Bearer juan' },
      payload: { name: 'Club Que No Debería Crearse' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('rejects invalid input (empty name) with 400', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/clubs',
      headers: { authorization: 'Bearer camila' },
      payload: { name: '' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects a duplicate name among active clubs with 409', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/clubs',
      headers: { authorization: 'Bearer camila' },
      payload: { name: 'Señor Pato' },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });
});

describe('GET /api/v1/admin/clubs/:clubId', () => {
  it('lets a SUPERADMIN view any club', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: `/api/v1/admin/clubs/${otherClubId}`, headers: { authorization: 'Bearer camila' } });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it('lets a CLUB_ADMIN view their own club', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { activeCourtsCount: number } };
    expect(body.data.activeCourtsCount).toBeGreaterThan(0);

    await app.close();
  });

  it('denies a CLUB_ADMIN of a different club with 403', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/clubs/${otherClubId}`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('denies a plain member with 403', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}`,
      headers: { authorization: 'Bearer martin' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('returns 404 for a nonexistent club', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/clubs/00000000-0000-0000-0000-000000009999',
      headers: { authorization: 'Bearer camila' },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });
});

describe('PUT /api/v1/admin/clubs/:clubId', () => {
  it('lets a SUPERADMIN edit name, description, city, address and isActive', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/clubs/${otherClubId}`,
      headers: { authorization: 'Bearer camila' },
      payload: { name: 'Otro Club Editado', description: 'Nueva descripción', city: 'Rosario', address: 'Calle 123', isActive: false },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { name: string; description: string; city: string; address: string; isActive: boolean } };
    expect(body.data).toMatchObject({
      name: 'Otro Club Editado',
      description: 'Nueva descripción',
      city: 'Rosario',
      address: 'Calle 123',
      isActive: false,
    });

    // revert so later tests in this file see the club ACTIVE again
    await prisma.club.update({ where: { id: otherClubId }, data: { status: 'ACTIVE' } });
    await app.close();
  });

  it('does not delete courts or memberships when a club is deactivated', async () => {
    const app = await buildApp();
    await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}`,
      headers: { authorization: 'Bearer camila' },
      payload: { isActive: false },
    });

    const courts = await prisma.court.findMany({ where: { clubId: SEED_IDS.club.senorPato } });
    const memberships = await prisma.clubMembership.findMany({ where: { clubId: SEED_IDS.club.senorPato } });
    expect(courts.length).toBeGreaterThan(0);
    expect(memberships.length).toBeGreaterThan(0);

    await prisma.club.update({ where: { id: SEED_IDS.club.senorPato }, data: { status: 'ACTIVE' } });
    await app.close();
  });

  it('lets a CLUB_ADMIN edit description/city/address but not name or isActive', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}`,
      headers: { authorization: 'Bearer juan' },
      payload: { description: 'Descripción actualizada por el club admin' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { description: string } };
    expect(body.data.description).toBe('Descripción actualizada por el club admin');

    await app.close();
  });

  it('rejects a CLUB_ADMIN attempt to rename the club with 403', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}`,
      headers: { authorization: 'Bearer juan' },
      payload: { name: 'Nombre No Autorizado' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('rejects a CLUB_ADMIN attempt to (de)activate the club with 403', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}`,
      headers: { authorization: 'Bearer juan' },
      payload: { isActive: false },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });

  it('denies a CLUB_ADMIN of a different club with 403', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/clubs/${otherClubId}`,
      headers: { authorization: 'Bearer juan' },
      payload: { description: 'No debería poder' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});

describe('GET /api/v1/admin/users/search', () => {
  it('lets a SUPERADMIN search users by name, excluding private fields', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users/search?q=Mart',
      headers: { authorization: 'Bearer camila' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ id: string; displayName: string; username: string | null; avatarUrl: string | null }> };
    expect(body.data.some((user) => user.id === SEED_IDS.users.martin)).toBe(true);
    for (const user of body.data) {
      expect(Object.keys(user).sort()).toEqual(['avatarUrl', 'displayName', 'id', 'username']);
    }

    await app.close();
  });

  it('denies a non-superadmin with 403', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/users/search?q=Mart',
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});

describe('club admin assignment', () => {
  it('lets a SUPERADMIN promote an existing MEMBER to CLUB_ADMIN, and a CLUB_ADMIN can view (not modify) the admin list', async () => {
    const app = await buildApp();

    await prisma.clubMembership.upsert({
      where: { clubId_userId: { clubId: otherClubId, userId: SEED_IDS.users.ana } },
      update: { role: 'MEMBER', status: 'ACTIVE' },
      create: { clubId: otherClubId, userId: SEED_IDS.users.ana, role: 'MEMBER', status: 'ACTIVE' },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/clubs/${otherClubId}/admins`,
      headers: { authorization: 'Bearer camila' },
      payload: { userId: SEED_IDS.users.ana },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { data: Array<{ id: string }> };
    expect(body.data.map((admin) => admin.id)).toContain(SEED_IDS.users.ana);

    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId: otherClubId, userId: SEED_IDS.users.ana } },
    });
    expect(membership).toMatchObject({ role: 'CLUB_ADMIN', status: 'ACTIVE' });

    const viewResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/clubs/${otherClubId}/admins`,
      headers: { authorization: 'Bearer luciano' },
    });
    expect(viewResponse.statusCode).toBe(200);

    await prisma.clubMembership.delete({ where: { clubId_userId: { clubId: otherClubId, userId: SEED_IDS.users.ana } } });
    await app.close();
  });

  it('reactivates an INACTIVE membership instead of creating a duplicate row', async () => {
    const app = await buildApp();

    await prisma.clubMembership.create({
      data: { clubId: otherClubId, userId: SEED_IDS.users.sofia, role: 'CLUB_ADMIN', status: 'INACTIVE' },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/clubs/${otherClubId}/admins`,
      headers: { authorization: 'Bearer camila' },
      payload: { userId: SEED_IDS.users.sofia },
    });

    expect(response.statusCode).toBe(201);

    const memberships = await prisma.clubMembership.findMany({ where: { clubId: otherClubId, userId: SEED_IDS.users.sofia } });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({ role: 'CLUB_ADMIN', status: 'ACTIVE' });

    await prisma.clubMembership.delete({ where: { clubId_userId: { clubId: otherClubId, userId: SEED_IDS.users.sofia } } });
    await app.close();
  });

  it('assigning the same user twice never creates duplicate membership rows', async () => {
    const app = await buildApp();

    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/clubs/${otherClubId}/admins`,
      headers: { authorization: 'Bearer camila' },
      payload: { userId: SEED_IDS.users.diego },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/admin/clubs/${otherClubId}/admins`,
      headers: { authorization: 'Bearer camila' },
      payload: { userId: SEED_IDS.users.diego },
    });

    const memberships = await prisma.clubMembership.findMany({ where: { clubId: otherClubId, userId: SEED_IDS.users.diego } });
    expect(memberships).toHaveLength(1);

    await prisma.clubMembership.delete({ where: { clubId_userId: { clubId: otherClubId, userId: SEED_IDS.users.diego } } });
    await app.close();
  });

  it('degrades a removed admin to MEMBER rather than deleting the membership row', async () => {
    const app = await buildApp();

    await prisma.clubMembership.create({
      data: { clubId: otherClubId, userId: SEED_IDS.users.valentina, role: 'CLUB_ADMIN', status: 'ACTIVE' },
    });

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/clubs/${otherClubId}/admins/${SEED_IDS.users.valentina}`,
      headers: { authorization: 'Bearer camila' },
    });

    expect(response.statusCode).toBe(200);
    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId: otherClubId, userId: SEED_IDS.users.valentina } },
    });
    expect(membership).toMatchObject({ role: 'MEMBER', status: 'ACTIVE' });

    await prisma.clubMembership.delete({ where: { clubId_userId: { clubId: otherClubId, userId: SEED_IDS.users.valentina } } });
    await app.close();
  });

  it('refuses to remove the last active admin of a club', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/clubs/${otherClubId}/admins/${SEED_IDS.users.luciano}`,
      headers: { authorization: 'Bearer camila' },
    });

    expect(response.statusCode).toBe(409);

    const membership = await prisma.clubMembership.findUnique({
      where: { clubId_userId: { clubId: otherClubId, userId: SEED_IDS.users.luciano } },
    });
    expect(membership?.role).toBe('CLUB_ADMIN');

    await app.close();
  });

  it('rejects a non-superadmin attempting to assign or remove admins with 403', async () => {
    const app = await buildApp();
    const assignResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}/admins`,
      headers: { authorization: 'Bearer juan' },
      payload: { userId: SEED_IDS.users.martin },
    });
    expect(assignResponse.statusCode).toBe(403);

    const removeResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}/admins/${SEED_IDS.users.juan}`,
      headers: { authorization: 'Bearer juan' },
    });
    expect(removeResponse.statusCode).toBe(403);

    await app.close();
  });
});

describe('courts admin', () => {
  it('lists Señor Pato seeded courts with sport/modality names', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}/courts`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: Array<{ id: string; sportName: string; modalityName: string }> };
    expect(body.data.map((court) => court.id)).toContain(SEED_IDS.courts.padel1);

    await app.close();
  });

  it('creates a court with server-defaulted price/duration and rejects an unknown modality', async () => {
    const app = await buildApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}/courts`,
      headers: { authorization: 'Bearer juan' },
      payload: { name: 'Cancha Test 1', sportModalityId: SEED_IDS.modalities.padelDoubles },
    });

    expect(createResponse.statusCode).toBe(201);
    const body = createResponse.json() as { data: { id: string; name: string; isActive: boolean } };
    expect(body.data).toMatchObject({ name: 'Cancha Test 1', isActive: true });

    const dbCourt = await prisma.court.findUnique({ where: { id: body.data.id } });
    expect(Number(dbCourt?.pricePerHour)).toBe(0);
    expect(dbCourt?.slotDurationMinutes).toBeGreaterThan(0);

    const invalidModalityResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}/courts`,
      headers: { authorization: 'Bearer juan' },
      payload: { name: 'Cancha Test 2', sportModalityId: '00000000-0000-0000-0000-000000009999' },
    });
    expect(invalidModalityResponse.statusCode).toBe(422);

    const duplicateNameResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}/courts`,
      headers: { authorization: 'Bearer juan' },
      payload: { name: 'Cancha Test 1', sportModalityId: SEED_IDS.modalities.padelDoubles },
    });
    expect(duplicateNameResponse.statusCode).toBe(409);

    await prisma.court.delete({ where: { id: body.data.id } });
    await app.close();
  });

  it('edits and deactivates a court without deleting it, and prevents cross-club editing by id substitution', async () => {
    const app = await buildApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/clubs/${otherClubId}/courts`,
      headers: { authorization: 'Bearer camila' },
      payload: { name: 'Cancha Otro Club', sportModalityId: SEED_IDS.modalities.football5 },
    });
    const courtId = (createResponse.json() as { data: { id: string } }).data.id;

    const crossClubResponse = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/clubs/${SEED_IDS.club.senorPato}/courts/${courtId}`,
      headers: { authorization: 'Bearer juan' },
      payload: { isActive: false },
    });
    expect(crossClubResponse.statusCode).toBe(404);

    const deactivateResponse = await app.inject({
      method: 'PUT',
      url: `/api/v1/admin/clubs/${otherClubId}/courts/${courtId}`,
      headers: { authorization: 'Bearer camila' },
      payload: { isActive: false, description: 'Fuera de servicio' },
    });
    expect(deactivateResponse.statusCode).toBe(200);

    const persisted = await prisma.court.findUnique({ where: { id: courtId } });
    expect(persisted).not.toBeNull();
    expect(persisted?.active).toBe(false);
    expect(persisted?.description).toBe('Fuera de servicio');

    await prisma.court.delete({ where: { id: courtId } });
    await app.close();
  });

  it('denies court management to a CLUB_ADMIN of a different club', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/clubs/${otherClubId}/courts`,
      headers: { authorization: 'Bearer juan' },
    });

    expect(response.statusCode).toBe(403);
    await app.close();
  });
});
