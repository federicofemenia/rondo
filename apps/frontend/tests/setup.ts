import { afterEach, beforeEach, vi } from 'vitest';
import type { CandidateDto, MatchInvitationDto, SportDto, SportProfileDto, UserClubDto } from '@rondo/contracts';

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

/** Mutable per-test fixture for the sport-profiles endpoints; reset to empty before every test. */
export const mockSportProfiles: SportProfileDto[] = [];
/** sportIds added here make every sport-profile request for that sport respond with a 500, to exercise error states. */
export const mockSportProfileFailingSportIds = new Set<string>();

/** Mutable per-test fixture for GET /api/v1/matches/:matchId/candidates; reset to empty before every test. */
export const mockCandidates: CandidateDto[] = [];
/** matchIds added here make the candidates request for that match respond with a 500, to exercise error states. */
export const mockCandidatesFailingMatchIds = new Set<string>();

/** Mutable per-test fixture for GET /api/v1/me/invitations, also mutated in place by the accept/reject mock handlers below. */
export const mockMyInvitations: MatchInvitationDto[] = [];
/** matchIds added here make POST .../invitations respond with a 500, to exercise the CandidatesPage error state. */
export const mockInvitationCreateFailingMatchIds = new Set<string>();
/** invitationIds added here make POST .../accept|reject respond with a 500, to exercise the InvitationsPage error state. */
export const mockInvitationRespondFailingIds = new Set<string>();

function findSportName(sportId: string): string {
  return mockSportsCatalog.find((sport) => sport.id === sportId)?.name ?? '';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const originalFetch = global.fetch;

beforeEach(() => {
  mockSportProfiles.length = 0;
  mockSportProfileFailingSportIds.clear();
  mockCandidates.length = 0;
  mockCandidatesFailingMatchIds.clear();
  mockMyInvitations.length = 0;
  mockInvitationCreateFailingMatchIds.clear();
  mockInvitationRespondFailingIds.clear();
});

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

    if (method === 'GET' && url.endsWith('/api/v1/me/invitations')) {
      return json({ data: mockMyInvitations });
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
            scheduledDate: body.scheduledDate ?? '2026-08-08',
            availabilityStartMinutes: body.availabilityStartMinutes ?? 600,
            availabilityEndMinutes: body.availabilityEndMinutes ?? 1200,
            startsAt: body.startsAt ?? null,
            endsAt: body.startsAt ? new Date(new Date(body.startsAt as string).getTime() + 60 * 60_000).toISOString() : null,
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
          scheduledDate: '2026-08-08',
          availabilityStartMinutes: 600,
          availabilityEndMinutes: 1200,
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

    if (method === 'PATCH' && /\/api\/v1\/matches\/[^/]+\/schedule$/.test(url)) {
      const body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {};
      const now = new Date().toISOString();
      return json({
        data: {
          id: 'match-created-1',
          status: 'ORGANIZING',
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
          scheduledDate: body.scheduledDate ?? '2026-08-08',
          availabilityStartMinutes: body.availabilityStartMinutes ?? 600,
          availabilityEndMinutes: body.availabilityEndMinutes ?? 1200,
          startsAt: body.startsAt ?? null,
          endsAt: body.startsAt ? new Date(new Date(body.startsAt as string).getTime() + 60 * 60_000).toISOString() : null,
          organizerUserId: 'user-test',
          organizerDisplayName: 'Federico Femenia',
          isOrganizer: true,
          createdAt: now,
          statusChangedAt: now,
          statusChangedByType: 'USER',
          statusChangedByUser: null,
          cancellationReason: null,
        },
      });
    }

    if (/\/api\/v1\/matches\/[^/]+\/ratings$/.test(url)) {
      return json({
        data: { matchId: 'unknown', enabled: false, closed: false, closeAt: new Date().toISOString(), pendingCount: 0, participants: [] },
      });
    }

    if (method === 'GET' && url.endsWith('/api/v1/me/sport-profiles')) {
      return json({ data: mockSportProfiles });
    }

    const sportProfileMatch = url.match(/\/api\/v1\/me\/sport-profiles\/([^/]+)(\/availability)?$/);
    if (sportProfileMatch) {
      const sportId = sportProfileMatch[1]!;
      const isAvailability = Boolean(sportProfileMatch[2]);

      if (mockSportProfileFailingSportIds.has(sportId)) {
        return json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } }, 500);
      }

      if (method === 'PUT' && !isAvailability) {
        const body = init?.body
          ? (JSON.parse(init.body as string) as { positions: string[]; isAvailableForInvitations: boolean })
          : { positions: [], isAvailableForInvitations: true };
        const now = new Date().toISOString();
        let profile = mockSportProfiles.find((candidate) => candidate.sportId === sportId);
        if (!profile) {
          profile = {
            id: `profile-${sportId}`,
            sportId,
            sportName: findSportName(sportId),
            positions: body.positions,
            isAvailableForInvitations: body.isAvailableForInvitations,
            availability: [],
            createdAt: now,
            updatedAt: now,
          };
          mockSportProfiles.push(profile);
        } else {
          profile.positions = body.positions;
          profile.isAvailableForInvitations = body.isAvailableForInvitations;
          profile.updatedAt = now;
        }
        return json({ data: profile });
      }

      if (method === 'PUT' && isAvailability) {
        const body = init?.body
          ? (JSON.parse(init.body as string) as { slots: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number }> })
          : { slots: [] };
        const profile = mockSportProfiles.find((candidate) => candidate.sportId === sportId);
        if (!profile) {
          return json({ error: { code: 'SPORT_PROFILE_NOT_FOUND', message: 'No tenés un perfil deportivo para este deporte.' } }, 404);
        }
        profile.availability = body.slots.map((slot, index) => ({ id: `slot-${sportId}-${index}`, ...slot }));
        return json({ data: profile });
      }

      if (method === 'DELETE') {
        const index = mockSportProfiles.findIndex((candidate) => candidate.sportId === sportId);
        if (index === -1) {
          return json({ error: { code: 'SPORT_PROFILE_NOT_FOUND', message: 'No tenés un perfil deportivo para este deporte.' } }, 404);
        }
        mockSportProfiles.splice(index, 1);
        return new Response(null, { status: 204 });
      }
    }

    const candidatesMatch = url.match(/\/api\/v1\/matches\/([^/]+)\/candidates$/);
    if (method === 'GET' && candidatesMatch) {
      const matchId = candidatesMatch[1]!;
      if (mockCandidatesFailingMatchIds.has(matchId)) {
        return json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } }, 500);
      }
      return json({ data: mockCandidates });
    }

    const createInvitationMatch = url.match(/\/api\/v1\/matches\/([^/]+)\/invitations$/);
    if (method === 'POST' && createInvitationMatch) {
      const matchId = createInvitationMatch[1]!;
      if (mockInvitationCreateFailingMatchIds.has(matchId)) {
        return json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } }, 500);
      }
      const body = init?.body ? (JSON.parse(init.body as string) as { invitedUserId: string; position?: string }) : { invitedUserId: '' };
      const now = new Date().toISOString();
      const invitation: MatchInvitationDto = {
        id: `invitation-${matchId}-${body.invitedUserId}`,
        matchId,
        status: 'PENDING',
        position: body.position ?? null,
        invitedUserId: body.invitedUserId,
        invitedUserDisplayName: 'Candidato',
        invitedById: 'user-test',
        organizerDisplayName: 'Federico Femenia',
        sportName: 'Fútbol',
        modalityName: 'Fútbol 5',
        clubName: null,
        scheduledDate: '2026-08-08',
        availabilityStartMinutes: 600,
        availabilityEndMinutes: 1200,
        startsAt: null,
        endsAt: null,
        createdAt: now,
        respondedAt: null,
      };
      return json({ data: invitation }, 201);
    }

    const respondInvitationMatch = url.match(/\/api\/v1\/invitations\/([^/]+)\/(accept|reject)$/);
    if (method === 'POST' && respondInvitationMatch) {
      const invitationId = respondInvitationMatch[1]!;
      const action = respondInvitationMatch[2]! as 'accept' | 'reject';
      if (mockInvitationRespondFailingIds.has(invitationId)) {
        return json({ error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } }, 500);
      }
      const invitation = mockMyInvitations.find((current) => current.id === invitationId);
      if (!invitation) {
        return json({ error: { code: 'INVITATION_NOT_FOUND', message: 'La invitación no existe.' } }, 404);
      }
      invitation.status = action === 'accept' ? 'ACCEPTED' : 'REJECTED';
      invitation.respondedAt = new Date().toISOString();
      return json({ data: invitation });
    }

    throw new Error(`Unhandled fetch in tests: ${method} ${url}`);
  }) as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});
