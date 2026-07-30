import { afterEach, beforeEach, vi } from 'vitest';
import type { SportDto, UserClubDto } from '@rondo/contracts';

type MockClerkError = { message: string; longMessage?: string };

export const signInMock = {
  status: 'complete' as string,
  password: vi.fn(async (): Promise<{ error: MockClerkError | null }> => ({ error: null })),
  finalize: vi.fn(async (): Promise<{ error: MockClerkError | null }> => ({ error: null })),
};

export const signUpMock = {
  status: 'complete' as string,
  unverifiedFields: [] as string[],
  password: vi.fn(async (): Promise<{ error: MockClerkError | null }> => ({ error: null })),
  finalize: vi.fn(async (): Promise<{ error: MockClerkError | null }> => ({ error: null })),
  verifications: {
    sendEmailCode: vi.fn(async (): Promise<{ error: MockClerkError | null }> => ({ error: null })),
    verifyEmailCode: vi.fn(async (): Promise<{ error: MockClerkError | null }> => ({ error: null })),
  },
};

export const clerkAuthMock = {
  isLoaded: true,
  isSignedIn: false,
  userId: 'user_test',
  getToken: vi.fn(async () => 'test-token'),
};

export const clerkSignOutMock = vi.fn(async () => {});

vi.mock('@clerk/react', () => ({
  useSignIn: () => ({ signIn: signInMock, errors: null, fetchStatus: 'idle' }),
  useSignUp: () => ({ signUp: signUpMock, errors: null, fetchStatus: 'idle' }),
  useAuth: () => clerkAuthMock,
  useClerk: () => ({ signOut: clerkSignOutMock }),
  useUser: () => ({ isLoaded: true, isSignedIn: true, user: null }),
  ClerkProvider: ({ children }: { children: unknown }) => children,
}));

function resetClerkMocks() {
  signInMock.status = 'complete';
  signInMock.password.mockReset().mockResolvedValue({ error: null });
  signInMock.finalize.mockReset().mockResolvedValue({ error: null });

  signUpMock.status = 'complete';
  signUpMock.unverifiedFields = [];
  signUpMock.password.mockReset().mockResolvedValue({ error: null });
  signUpMock.finalize.mockReset().mockResolvedValue({ error: null });
  signUpMock.verifications.sendEmailCode.mockReset().mockResolvedValue({ error: null });
  signUpMock.verifications.verifyEmailCode.mockReset().mockResolvedValue({ error: null });

  clerkAuthMock.isLoaded = true;
  clerkAuthMock.isSignedIn = false;
  clerkAuthMock.getToken.mockReset().mockResolvedValue('test-token');

  clerkSignOutMock.mockReset().mockResolvedValue(undefined);
}

beforeEach(() => {
  resetClerkMocks();
});

export const mockSportsCatalog: SportDto[] = [
  {
    id: 'sport-football',
    code: 'football',
    name: 'Fútbol',
    displayOrder: 1,
    modalities: [{ id: 'modality-football-5', code: 'football-5', name: 'Fútbol 5', playersCount: 10, displayOrder: 1 }],
  },
  {
    id: 'sport-padel',
    code: 'padel',
    name: 'Pádel',
    displayOrder: 2,
    modalities: [{ id: 'modality-padel-doubles', code: 'padel-doubles', name: 'Dobles', playersCount: 4, displayOrder: 1 }],
  },
];

export const mockClubs: UserClubDto[] = [{ id: 'club-1', code: 'senor-pato', name: 'Club Señor Pato', role: 'MEMBER', status: 'ACTIVE', isFavorite: false }];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = (init?.method ?? 'GET').toUpperCase();

    if (url.includes('/api/v1/sports')) {
      return json({ data: mockSportsCatalog });
    }

    if (url.includes('/api/v1/me/clubs')) {
      return json({ data: mockClubs });
    }

    if (url.endsWith('/api/v1/me')) {
      return json({ data: { id: 'user-test', email: 'federico@rondo.dev', firstName: 'Federico', lastName: 'Femenia', avatarUrl: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } });
    }

    if (url.endsWith('/api/v1/me/matches')) {
      return json({ data: [] });
    }

    if (url.endsWith('/api/v1/me/pending-tasks')) {
      return json({ data: [] });
    }

    if (method === 'POST' && /\/api\/v1\/matches$/.test(url)) {
      const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
      const modalityId = body.sportModalityId as string | undefined;
      const sport = mockSportsCatalog.find((candidate) => candidate.modalities.some((modality) => modality.id === modalityId));
      const modality = sport?.modalities.find((candidate) => candidate.id === modalityId);
      const club = mockClubs.find((candidate) => candidate.id === body.clubId);
      const now = new Date().toISOString();
      return json(
        {
          data: {
            id: 'match-created-1',
            status: 'ORGANIZING',
            clubId: (body.clubId as string | null | undefined) ?? null,
            clubName: club?.name ?? null,
            sportModalityId: modalityId ?? '',
            sportName: sport?.name ?? '',
            modalityName: modality?.name ?? '',
            courtName: null,
            minPlayers: body.minPlayers ?? 0,
            maxPlayers: body.maxPlayers ?? 0,
            positions: body.positions ?? [],
            participantsCount: 1,
            startsAt: body.startsAt ?? null,
            endsAt: body.endsAt ?? null,
            organizerUserId: 'user-test',
            organizerDisplayName: 'Federico Femenia',
            isOrganizer: true,
            createdAt: now,
            statusChangedAt: now,
            statusChangedByType: 'USER',
            statusChangedByUser: null,
            cancellationReason: null,
          },
        },
        201,
      );
    }

    if (method === 'POST' && /\/api\/v1\/matches\/[^/]+\/cancellation$/.test(url)) {
      const now = new Date().toISOString();
      return json({
        data: {
          id: 'match-created-1',
          status: 'CANCELLED',
          clubId: null,
          clubName: null,
          sportModalityId: 'modality-football-5',
          sportName: 'Fútbol',
          modalityName: 'Fútbol 5',
          courtName: null,
          minPlayers: 4,
          maxPlayers: 10,
          positions: [],
          participantsCount: 1,
          startsAt: null,
          endsAt: null,
          organizerUserId: 'user-test',
          organizerDisplayName: 'Federico Femenia',
          isOrganizer: true,
          createdAt: now,
          statusChangedAt: now,
          statusChangedByType: 'USER',
          statusChangedByUser: { id: 'user-test', displayName: 'Federico Femenia' },
          cancellationReason: null,
        },
      });
    }

    if (/\/api\/v1\/matches\/[^/]+\/ratings$/.test(url)) {
      return json({
        data: { matchId: 'unknown', enabled: false, closed: false, closeAt: new Date().toISOString(), pendingCount: 0, participants: [] },
      });
    }

    throw new Error(`Unhandled fetch in tests: ${method} ${url}`);
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});
