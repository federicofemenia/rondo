import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildServer } from '../../src/app/server.js';
import { prisma } from '../../src/infrastructure/database/prisma.js';
import { runBaseSeed } from '../../src/infrastructure/database/seedBase.js';

function buildApp() {
  return buildServer({ NODE_ENV: 'test' });
}

function sessionCookieFrom(response: { cookies: Array<{ name: string; value: string }> }): string | undefined {
  return response.cookies.find((cookie) => cookie.name === 'rondo_session')?.value;
}

const createdUsernames: string[] = [];

function uniqueUsername(prefix: string): string {
  const username = `${prefix}_${randomUUID().slice(0, 8)}`;
  createdUsernames.push(username);
  return username;
}

beforeAll(async () => {
  await runBaseSeed();
});

afterAll(async () => {
  const users = await prisma.user.findMany({ where: { username: { in: createdUsernames } }, select: { id: true } });
  const userIds = users.map((user) => user.id);
  await prisma.session.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.clubMembership.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.playerAvailability.deleteMany({ where: { userSportProfile: { userId: { in: userIds } } } });
  await prisma.userSportProfile.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe('POST /api/v1/auth/register', () => {
  it('registers a new user, sets the session cookie, and never creates a ClubMembership', async () => {
    const app = await buildApp();
    const username = uniqueUsername('register_ok');

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Nuevo Jugador', username, password: 'unaClave123', confirmPassword: 'unaClave123' },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { data: { authenticated: boolean; user: { username: string; displayName: string; role: string } } };
    expect(body.data.authenticated).toBe(true);
    expect(body.data.user.username).toBe(username.toLowerCase());
    expect(body.data.user.displayName).toBe('Nuevo Jugador');
    expect(body.data.user.role).toBe('USER');

    const cookie = sessionCookieFrom(response);
    expect(cookie).toBeTruthy();

    const user = await prisma.user.findUniqueOrThrow({ where: { username: username.toLowerCase() } });
    expect(user.passwordHash).not.toBe('unaClave123');

    const memberships = await prisma.clubMembership.findMany({ where: { userId: user.id } });
    expect(memberships).toHaveLength(0);

    await app.close();
  });

  it('normalizes username casing/whitespace -- Federico, federico and FEDERICO are the same account', async () => {
    const app = await buildApp();
    const base = uniqueUsername('normalize');

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Test', username: base.toUpperCase(), password: 'unaClave123', confirmPassword: 'unaClave123' },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Test', username: `  ${base}  `, password: 'otraClave456', confirmPassword: 'otraClave456' },
    });

    expect(second.statusCode).toBe(409);
    await app.close();
  });

  it('creates default sport profiles (all sports, full weekly availability) on registration', async () => {
    const app = await buildApp();
    const username = uniqueUsername('register_profiles');

    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Test', username, password: 'unaClave123', confirmPassword: 'unaClave123' },
    });
    const cookie = sessionCookieFrom(registerResponse)!;

    const response = await app.inject({ method: 'GET', url: '/api/v1/me/sport-profiles', cookies: { rondo_session: cookie } });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: Array<{ isAvailableForInvitations: boolean; availability: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }> }>;
    };

    expect(body.data.length).toBeGreaterThanOrEqual(2);
    for (const profile of body.data) {
      expect(profile.isAvailableForInvitations).toBe(true);
      expect(profile.availability).toHaveLength(7);
      for (const slot of profile.availability) {
        expect(slot.startMinutes).toBe(0);
        expect(slot.endMinutes).toBe(1440);
      }
    }

    await app.close();
  });

  it('rejects a duplicate username with 409', async () => {
    const app = await buildApp();
    const username = uniqueUsername('register_dup');

    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Uno', username, password: 'unaClave123', confirmPassword: 'unaClave123' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Dos', username, password: 'otraClave456', confirmPassword: 'otraClave456' },
    });

    expect(response.statusCode).toBe(409);
    expect((response.json() as { error: { code: string } }).error.code).toBe('USERNAME_TAKEN');

    await app.close();
  });

  it('rejects a password shorter than 8 characters', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Test', username: uniqueUsername('register_short'), password: 'corta12', confirmPassword: 'corta12' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });

  it('rejects mismatched password/confirmPassword', async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Test', username: uniqueUsername('register_mismatch'), password: 'unaClave123', confirmPassword: 'otraClave456' },
    });

    expect(response.statusCode).toBe(400);
    await app.close();
  });
});

describe('POST /api/v1/auth/login', () => {
  async function registerUser(username: string, password: string) {
    const app = await buildApp();
    await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Login Test', username, password, confirmPassword: password },
    });
    await app.close();
  }

  it('logs in with correct credentials, case-insensitively, and sets a fresh session cookie', async () => {
    const username = uniqueUsername('login_ok');
    await registerUser(username, 'unaClave123');

    const app = await buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: username.toUpperCase(), password: 'unaClave123' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { data: { authenticated: boolean; user: { username: string } } };
    expect(body.data.authenticated).toBe(true);
    expect(body.data.user.username).toBe(username.toLowerCase());
    expect(sessionCookieFrom(response)).toBeTruthy();

    await app.close();
  });

  it('uses the identical generic error message for a nonexistent user and a wrong password', async () => {
    const username = uniqueUsername('login_wrong');
    await registerUser(username, 'unaClave123');

    const app = await buildApp();
    const wrongPassword = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username, password: 'incorrecta123' } });
    const noSuchUser = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: `nonexistent_${randomUUID().slice(0, 8)}`, password: 'incorrecta123' },
    });

    expect(wrongPassword.statusCode).toBe(401);
    expect(noSuchUser.statusCode).toBe(401);
    const wrongBody = wrongPassword.json() as { error: { code: string; message: string } };
    const noSuchBody = noSuchUser.json() as { error: { code: string; message: string } };
    expect(wrongBody.error.code).toBe('INVALID_CREDENTIALS');
    expect(wrongBody.error.message).toBe(noSuchBody.error.message);
    expect(sessionCookieFrom(wrongPassword)).toBeFalsy();

    await app.close();
  });

  it('creates a new Session row on every login', async () => {
    const username = uniqueUsername('login_session_row');
    await registerUser(username, 'unaClave123');

    const app = await buildApp();
    const user = await prisma.user.findUniqueOrThrow({ where: { username } });
    const before = await prisma.session.count({ where: { userId: user.id } });

    await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username, password: 'unaClave123' } });

    const after = await prisma.session.count({ where: { userId: user.id } });
    expect(after).toBe(before + 1);

    await app.close();
  });
});

describe('GET /api/v1/auth/session', () => {
  it('returns authenticated: false and a null user with no cookie', async () => {
    const app = await buildApp();
    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/session' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { authenticated: false, user: null } });

    await app.close();
  });

  it('resolves the real user once logged in', async () => {
    const app = await buildApp();
    const username = uniqueUsername('session_ok');
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Session Test', username, password: 'unaClave123', confirmPassword: 'unaClave123' },
    });
    const cookie = sessionCookieFrom(registerResponse)!;

    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/session', cookies: { rondo_session: cookie } });
    const body = response.json() as { data: { authenticated: boolean; user: { username: string } } };
    expect(body.data.authenticated).toBe(true);
    expect(body.data.user.username).toBe(username.toLowerCase());

    await app.close();
  });

  it('never leaks passwordHash or session tokens', async () => {
    const app = await buildApp();
    const username = uniqueUsername('session_no_leak');
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Test', username, password: 'unaClave123', confirmPassword: 'unaClave123' },
    });
    const cookie = sessionCookieFrom(registerResponse)!;

    const response = await app.inject({ method: 'GET', url: '/api/v1/auth/session', cookies: { rondo_session: cookie } });
    const body = response.json() as { data: { user: Record<string, unknown> } };
    expect(body.data.user.passwordHash).toBeUndefined();
    expect(body.data.user.tokenHash).toBeUndefined();

    await app.close();
  });
});

describe('POST /api/v1/auth/logout', () => {
  it('revokes the session so it can no longer authenticate, and clears the cookie', async () => {
    const app = await buildApp();
    const username = uniqueUsername('logout_ok');
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Test', username, password: 'unaClave123', confirmPassword: 'unaClave123' },
    });
    const cookie = sessionCookieFrom(registerResponse)!;

    const logoutResponse = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', cookies: { rondo_session: cookie } });
    expect(logoutResponse.statusCode).toBe(200);

    const afterLogout = await app.inject({ method: 'GET', url: '/api/v1/auth/session', cookies: { rondo_session: cookie } });
    expect((afterLogout.json() as { data: { authenticated: boolean } }).data.authenticated).toBe(false);

    await app.close();
  });

  it('is idempotent: logging out twice, or with no cookie at all, still responds 200', async () => {
    const app = await buildApp();
    const noCookie = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
    expect(noCookie.statusCode).toBe(200);

    const username = uniqueUsername('logout_twice');
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Test', username, password: 'unaClave123', confirmPassword: 'unaClave123' },
    });
    const cookie = sessionCookieFrom(registerResponse)!;

    const first = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', cookies: { rondo_session: cookie } });
    const second = await app.inject({ method: 'POST', url: '/api/v1/auth/logout', cookies: { rondo_session: cookie } });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);

    await app.close();
  });
});

describe('POST /api/v1/auth/change-password', () => {
  it('rejects an incorrect current password', async () => {
    const app = await buildApp();
    const username = uniqueUsername('change_pw_wrong');
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Test', username, password: 'unaClave123', confirmPassword: 'unaClave123' },
    });
    const cookie = sessionCookieFrom(registerResponse)!;

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      cookies: { rondo_session: cookie },
      payload: { currentPassword: 'incorrecta', newPassword: 'nuevaClave456', confirmNewPassword: 'nuevaClave456' },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('changes the password, keeps the current session valid, and revokes every OTHER session', async () => {
    const app = await buildApp();
    const username = uniqueUsername('change_pw_ok');
    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      payload: { displayName: 'Test', username, password: 'unaClave123', confirmPassword: 'unaClave123' },
    });
    const firstCookie = sessionCookieFrom(first)!;

    const second = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username, password: 'unaClave123' } });
    const secondCookie = sessionCookieFrom(second)!;

    const changeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/change-password',
      cookies: { rondo_session: firstCookie },
      payload: { currentPassword: 'unaClave123', newPassword: 'nuevaClave456', confirmNewPassword: 'nuevaClave456' },
    });
    expect(changeResponse.statusCode).toBe(204);

    const firstStillWorks = await app.inject({ method: 'GET', url: '/api/v1/auth/session', cookies: { rondo_session: firstCookie } });
    expect((firstStillWorks.json() as { data: { authenticated: boolean } }).data.authenticated).toBe(true);

    const secondNowRevoked = await app.inject({ method: 'GET', url: '/api/v1/auth/session', cookies: { rondo_session: secondCookie } });
    expect((secondNowRevoked.json() as { data: { authenticated: boolean } }).data.authenticated).toBe(false);

    const loginWithOldPassword = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username, password: 'unaClave123' } });
    expect(loginWithOldPassword.statusCode).toBe(401);

    const loginWithNewPassword = await app.inject({ method: 'POST', url: '/api/v1/auth/login', payload: { username, password: 'nuevaClave456' } });
    expect(loginWithNewPassword.statusCode).toBe(200);

    await app.close();
  });
});
