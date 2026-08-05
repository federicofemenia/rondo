import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchSummaryDto } from '@rondo/contracts';
import { clerkAuthMock, mockMyMatches, mockSingleMatchAccessDeniedIds } from './setup';

/**
 * App.tsx's push-deep-link consumption (see pushNavigation.ts) seeds its
 * pending-destination store from `window.location.search` at MODULE LOAD
 * time, and registers its service-worker `message` listener at that same
 * moment too -- both are true module-level singletons, evaluated once for
 * whichever test file first imports App.tsx. The rest of this suite's
 * App.test.tsx imports App.tsx statically at the top of the file, so it
 * cannot exercise a specific starting URL or a specific service-worker
 * message per test. This file instead calls `vi.resetModules()` and
 * dynamically re-imports App.tsx (and therefore pushNavigation.ts) fresh
 * for every test, after first setting up whatever cold-start URL or
 * service-worker stub that test needs -- the only way to get a clean
 * pushNavigation.ts snapshot per test.
 */

const MATCH_ID_1 = '550e8400-e29b-41d4-a716-446655440001';
const MATCH_ID_2 = '550e8400-e29b-41d4-a716-446655440002';
const MATCH_ID_3 = '550e8400-e29b-41d4-a716-446655440003';
const MATCH_ID_4 = '550e8400-e29b-41d4-a716-446655440004';
const MATCH_ID_DENIED = '550e8400-e29b-41d4-a716-446655440099';

function fixtureMatch(overrides: Partial<MatchSummaryDto> = {}): MatchSummaryDto {
  const now = new Date().toISOString();
  return {
    id: MATCH_ID_1,
    status: 'ORGANIZING',
    clubId: null,
    clubName: null,
    venueType: 'TO_BE_DEFINED',
    customVenueName: null,
    sportId: 'sport-football',
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
    durationMinutes: 60,
    startsAt: null,
    endsAt: null,
    organizerUserId: 'user-test',
    organizerDisplayName: 'Federico Femenia',
    isOrganizer: true,
    createdAt: now,
    statusChangedAt: now,
    statusChangedByType: 'SYSTEM',
    statusChangedByUser: null,
    cancellationReason: null,
    ...overrides,
  };
}

function setUrl(pathWithQuery: string): void {
  window.history.replaceState(null, '', pathWithQuery);
}

async function renderFreshApp() {
  vi.resetModules();
  const { default: App } = await import('../src/App');
  return render(<App />);
}

describe('App push deep linking', () => {
  beforeEach(() => {
    clerkAuthMock.isSignedIn = true;
  });

  afterEach(() => {
    setUrl('/');
  });

  it('opens the match Chat tab directly from a cold-start ?open=match-chat deep link, once signed in and data has loaded', async () => {
    mockMyMatches.push(fixtureMatch());
    setUrl(`/?open=match-chat&matchId=${MATCH_ID_1}`);

    await renderFreshApp();

    await waitFor(() => expect(screen.getByRole('tab', { name: /^chat$/i, selected: true })).toBeTruthy());
    // The deep link is consumed exactly once and the URL goes back to clean.
    expect(window.location.search).toBe('');
  });

  it('opens the match Valoraciones tab from a cold-start ?open=match-ratings deep link', async () => {
    mockMyMatches.push(fixtureMatch({ id: MATCH_ID_2 }));
    setUrl(`/?open=match-ratings&matchId=${MATCH_ID_2}`);

    await renderFreshApp();

    await waitFor(() => expect(screen.getByRole('tab', { name: /^valoraciones$/i, selected: true })).toBeTruthy());
    expect(window.location.search).toBe('');
  });

  it('opens the match Jugadores tab from a cold-start ?open=match-players deep link', async () => {
    mockMyMatches.push(fixtureMatch({ id: MATCH_ID_3 }));
    setUrl(`/?open=match-players&matchId=${MATCH_ID_3}`);

    await renderFreshApp();

    await waitFor(() => expect(screen.getByRole('tab', { name: /^jugadores$/i, selected: true })).toBeTruthy());
    expect(window.location.search).toBe('');
  });

  it('lands on Home (Resumen) from a cold-start ?open=match-summary deep link', async () => {
    mockMyMatches.push(fixtureMatch({ id: MATCH_ID_4 }));
    setUrl(`/?open=match-summary&matchId=${MATCH_ID_4}`);

    await renderFreshApp();

    await waitFor(() => expect(screen.getByRole('tab', { name: /^resumen$/i, selected: true })).toBeTruthy());
    expect(window.location.search).toBe('');
  });

  it('stays on Home and clears the URL when the deep link points at an invitation', async () => {
    setUrl('/?open=invitations&invitationId=550e8400-e29b-41d4-a716-446655440000');

    await renderFreshApp();

    await screen.findByRole('heading', { name: /hola, federico/i });
    await waitFor(() => expect(window.location.search).toBe(''));
  });

  it('shows an error and falls back to Home when the deep-linked match no longer exists (404)', async () => {
    setUrl('/?open=match-chat&matchId=00000000-0000-0000-0000-000000009999');

    await renderFreshApp();

    await screen.findByText(/el partido ya no está disponible/i);
    await screen.findByRole('heading', { name: /hola, federico/i });
    expect(window.location.search).toBe('');
  });

  it('shows an error and falls back to Home when the deep-linked match is inaccessible (403)', async () => {
    mockSingleMatchAccessDeniedIds.add(MATCH_ID_DENIED);
    setUrl(`/?open=match-chat&matchId=${MATCH_ID_DENIED}`);

    await renderFreshApp();

    await screen.findByText(/no tenés acceso a este partido/i);
    await screen.findByRole('heading', { name: /hola, federico/i });
    expect(window.location.search).toBe('');
  });

  it('ignores an invalid (non-UUID-looking) matchId in the deep link rather than crashing', async () => {
    setUrl('/?open=match-chat&matchId=<script>alert(1)</script>');

    await renderFreshApp();

    await screen.findByRole('heading', { name: /hola, federico/i });
  });

  it('never opens an external url from a deep link payload', async () => {
    setUrl(`/?open=match-chat&matchId=${MATCH_ID_1}`);
    mockMyMatches.push(fixtureMatch());

    await renderFreshApp();

    await waitFor(() => expect(screen.getByRole('tab', { name: /^chat$/i, selected: true })).toBeTruthy());
    expect(window.location.href).toMatch(/^http:\/\/localhost/);
  });
});
