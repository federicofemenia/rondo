import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import type { MatchSummaryDto, UserClubDto } from '@rondo/contracts';
import { clerkAuthMock, mockClubs, mockMeProfile, mockMeState, mockMyInvitations, mockMyMatches } from './setup';
import { INSTALL_WELCOME_DISMISSAL_KEY } from '../src/installWelcome';

function logout() {
  fireEvent.click(screen.getByLabelText('Menú'));
  fireEvent.click(screen.getByText(/cerrar sesión/i));
}

function fixtureMatch(overrides: Partial<MatchSummaryDto> = {}): MatchSummaryDto {
  const now = new Date().toISOString();
  return {
    id: 'match-status-fixture',
    status: 'ORGANIZING',
    clubId: 'club-1',
    clubName: 'Club Señor Pato',
    venueType: 'CLUB',
    customVenueName: null,
    sportId: 'sport-football',
    sportModalityId: 'modality-football-5',
    sportName: 'Fútbol',
    modalityName: 'Fútbol 5',
    courtName: 'Cancha 2',
    minPlayers: 4,
    maxPlayers: 10,
    positions: [],
    participantsCount: 1,
    scheduledDate: '2026-08-05',
    availabilityStartMinutes: 17 * 60,
    availabilityEndMinutes: 22 * 60,
    durationMinutes: 60,
    startsAt: '2026-08-05T19:00:00.000Z',
    endsAt: '2026-08-05T20:00:00.000Z',
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

async function loginAndReachHome() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
  await screen.findByRole('heading', { name: /hola, federico/i });
}

describe('App', () => {
  it('renders the login screen first', () => {
    render(<App />);

    expect(screen.getByAltText(/rondo/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeTruthy();
  });

  it('hides the register link and shows the closed-beta message by default (VITE_BETA_SIGN_UP_ENABLED unset)', () => {
    render(<App />);

    expect(screen.queryByText(/registrate gratis/i)).toBeFalsy();
    expect(screen.getByText(/esta beta requiere una cuenta asignada/i)).toBeTruthy();
  });

  it('renders the home dashboard with the primary quick actions, and hides Próximos partidos when there is nothing upcoming', async () => {
    await loginAndReachHome();

    expect(screen.getByRole('heading', { name: /hola, federico/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /club señor pato/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /armar partido/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /reservar cancha/i })).toBeTruthy();
    expect(screen.queryByText(/^próximos partidos$/i)).toBeFalsy();
  });

  it('opens the 2-step armar partido flow from the home screen', async () => {
    await loginAndReachHome();

    fireEvent.click(screen.getByRole('button', { name: /armar partido/i }));

    expect(screen.getByRole('heading', { name: /armar partido/i })).toBeTruthy();
    expect(screen.getByText(/paso 1 de 2/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /volver/i })).toBeTruthy();
  });

  it('scrolls back to the top on every screen change', async () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    await loginAndReachHome();
    scrollToSpy.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /armar partido/i }));
    expect(screen.getByRole('heading', { name: /armar partido/i })).toBeTruthy();

    expect(scrollToSpy).toHaveBeenCalledWith(0, 0);
  });

  it('completes the wizard, shows the match on Home, and opens its detail with pending status', async () => {
    await loginAndReachHome();

    fireEvent.click(screen.getByRole('button', { name: /armar partido/i }));
    await screen.findByRole('option', { name: 'Fútbol' });
    fireEvent.change(screen.getByLabelText(/^deporte$/i), { target: { value: 'Fútbol' } });
    fireEvent.change(screen.getByLabelText(/jugadores mínimo/i), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText(/jugadores máximo/i), { target: { value: '10' } });
    fireEvent.click(screen.getByText('Delantero'));
    fireEvent.click(screen.getByRole('radio', { name: /^no$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^armar partido$/i }));

    expect(await screen.findByRole('heading', { name: /candidatos compatibles/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /finalizar/i }));

    await screen.findByRole('heading', { name: /hola, federico/i });
    expect(screen.queryByText(/tenés una reserva sin partido asociado/i)).toBeFalsy();

    // No club was selected while creating the match (venueType TO_BE_DEFINED):
    // the pending nudge is about the venue, never about a court -- a court
    // can't be booked without a club, so it must never appear as a "pending
    // task" in that case. Home's own "Tareas pendientes" section shows this
    // inline now (see HomePage.tsx), not only inside the notifications bell.
    expect(screen.getByText(/todavía no tiene sede/i)).toBeTruthy();
    expect(screen.queryByText(/todavía no tiene cancha/i)).toBeFalsy();

    fireEvent.click(screen.getByRole('button', { name: /fútbol • fútbol 5/i }));

    expect(screen.getByRole('tab', { name: /^resumen$/i })).toBeTruthy();
    expect(screen.getByText(/sede pendiente de confirmación/i)).toBeTruthy();
    expect(screen.queryByText(/cancha pendiente/i)).toBeFalsy();

    // Setting the club from the match detail's "Editar sede" form should
    // clear the "todavía no tiene sede" pending action back on Home -- it's
    // driven by the same `matches` state Home's Tareas pendientes section reads from.
    fireEvent.change(await screen.findByLabelText(/^editar sede$/i), { target: { value: 'club-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^guardar cambios$/i }));
    await waitFor(() => expect(screen.getByText(/sede seleccionada/i)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /volver/i }));
    await screen.findByRole('heading', { name: /hola, federico/i });

    expect(screen.queryByText(/todavía no tiene sede/i)).toBeFalsy();
  });

  it('shows a full pending invitation card on Home, and accepting it removes it from Invitaciones pendientes', async () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
      await vi.waitFor(() => expect(screen.getByRole('heading', { name: /hola, federico/i })).toBeTruthy());

      mockMyInvitations.push({
        id: 'invitation-home-1',
        matchId: 'match-home-1',
        status: 'PENDING',
        position: null,
        invitedUserId: 'user-test',
        invitedUserDisplayName: 'Federico Femenia',
        invitedById: 'organizer-1',
        organizerDisplayName: 'Juan Pérez',
        sportName: 'Fútbol',
        modalityName: 'Fútbol 5',
        clubName: null,
        scheduledDate: '2026-08-07',
        availabilityStartMinutes: 20 * 60,
        availabilityEndMinutes: 21 * 60,
        startsAt: '2026-08-07T20:00:00.000Z',
        endsAt: '2026-08-07T21:00:00.000Z',
        createdAt: '2026-08-01T00:00:00.000Z',
        respondedAt: null,
      });

      await vi.advanceTimersByTimeAsync(20_000);
      await vi.waitFor(() => expect(screen.getByText(/^invitaciones$/i)).toBeTruthy());
      expect(screen.getByText(/juan pérez te invitó a fútbol fútbol 5/i)).toBeTruthy();
      expect(screen.getByText(/sede a definir/i)).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /^aceptar$/i }));

      await vi.waitFor(() => expect(screen.queryByText(/^invitaciones$/i)).toBeFalsy());
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets the user reject a pending invitation from Home, which drops it without touching Próximos eventos', async () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
      await vi.waitFor(() => expect(screen.getByRole('heading', { name: /hola, federico/i })).toBeTruthy());

      mockMyInvitations.push({
        id: 'invitation-home-2',
        matchId: 'match-home-2',
        status: 'PENDING',
        position: null,
        invitedUserId: 'user-test',
        invitedUserDisplayName: 'Federico Femenia',
        invitedById: 'organizer-1',
        organizerDisplayName: 'Juan Pérez',
        sportName: 'Pádel',
        modalityName: 'Dobles',
        clubName: 'Club Señor Pato',
        scheduledDate: '2026-08-07',
        availabilityStartMinutes: 20 * 60,
        availabilityEndMinutes: 21 * 60,
        startsAt: null,
        endsAt: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        respondedAt: null,
      });

      await vi.advanceTimersByTimeAsync(20_000);
      await vi.waitFor(() => expect(screen.getByText(/^invitaciones$/i)).toBeTruthy());

      fireEvent.click(screen.getByRole('button', { name: /^rechazar$/i }));

      await vi.waitFor(() => expect(screen.queryByText(/^invitaciones$/i)).toBeFalsy());
      expect(screen.queryByText(/^próximos partidos$/i)).toBeFalsy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a new pending-invitation action on Home automatically after a background refresh', async () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
      await vi.waitFor(() => expect(screen.getByRole('heading', { name: /hola, federico/i })).toBeTruthy());
      expect(screen.queryByText(/tenés una invitación pendiente/i)).toBeFalsy();
      expect(screen.getByLabelText('Notificaciones')).toBeTruthy();

      mockMyInvitations.push({
        id: 'invitation-poll-1',
        matchId: 'match-poll-1',
        status: 'PENDING',
        position: null,
        invitedUserId: 'user-test',
        invitedUserDisplayName: 'Federico Femenia',
        invitedById: 'organizer-1',
        organizerDisplayName: 'Juan Pérez',
        sportName: 'Fútbol',
        modalityName: 'Fútbol 5',
        clubName: null,
        scheduledDate: '2026-08-05',
        availabilityStartMinutes: 17 * 60,
        availabilityEndMinutes: 22 * 60,
        startsAt: null,
        endsAt: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        respondedAt: null,
      });

      await vi.advanceTimersByTimeAsync(20_000);
      await vi.waitFor(() => expect(screen.getByLabelText('Notificaciones (1 pendiente)')).toBeTruthy());

      fireEvent.click(screen.getByLabelText('Notificaciones (1 pendiente)'));
      expect(screen.getByText(/tenés una invitación pendiente/i)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('creates a standalone booking and lands on its detail page with sin partido asociado', async () => {
    await loginAndReachHome();

    fireEvent.click(screen.getByRole('button', { name: /reservar cancha/i }));
    expect(screen.getByText(/elegí día y horario/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));

    expect(screen.getByText(/sin partido asociado/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^crear partido$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /asociar partido existente/i })).toBeTruthy();
  });

  it('shows the Clubes informational card, hides club button and novedades, blocks reservations, and never nags about it in the bell, when the user has no club', async () => {
    const backup = mockClubs.splice(0, mockClubs.length);
    try {
      await loginAndReachHome();

      expect(screen.queryByRole('button', { name: /club señor pato/i })).toBeFalsy();
      expect(screen.queryByText(/novedades de/i)).toBeFalsy();
      expect(screen.getByText('Clubes')).toBeTruthy();
      expect(screen.getByText(/todavía no estás asociado a ningún club/i)).toBeTruthy();

      // Lacking a club is never itself a pending action / red bell trigger.
      expect(screen.getByLabelText('Notificaciones')).toBeTruthy();
      fireEvent.click(screen.getByLabelText('Notificaciones'));
      expect(screen.getByText(/no tenés acciones pendientes/i)).toBeTruthy();
      fireEvent.keyDown(screen.getByText(/no tenés acciones pendientes/i), { key: 'Escape', code: 'Escape' });
      await waitFor(() => expect(screen.queryByText(/no tenés acciones pendientes/i)).toBeFalsy());

      fireEvent.click(screen.getByRole('button', { name: /reservar cancha/i }));
      expect(await screen.findByText(/no estás asociado a ningún club/i)).toBeTruthy();
      expect(screen.getByText(/para reservar una cancha primero necesitás pertenecer a un club/i)).toBeTruthy();
    } finally {
      mockClubs.push(...backup);
    }
  });

  it('shows a waking-up screen, then reaches Home once transient failures stop', async () => {
    clerkAuthMock.isSignedIn = true;
    mockMeState.failuresRemaining = 2;

    vi.useFakeTimers();
    try {
      render(<App />);
      await vi.waitFor(() => expect(screen.getByText(/estamos iniciando el servidor de rondo/i)).toBeTruthy());

      await vi.advanceTimersByTimeAsync(1500);
      await vi.advanceTimersByTimeAsync(3000);
      await vi.waitFor(() => expect(screen.getByRole('heading', { name: /hola, federico/i })).toBeTruthy());
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows a retry option after exhausting attempts, and recovers on click', async () => {
    clerkAuthMock.isSignedIn = true;
    mockMeState.failuresRemaining = 999;

    vi.useFakeTimers();
    try {
      render(<App />);
      await vi.waitFor(() => expect(screen.getByText(/estamos iniciando el servidor de rondo/i)).toBeTruthy());

      await vi.advanceTimersByTimeAsync(1500 + 3000 + 6000 + 1000);
      await vi.waitFor(() => expect(screen.getByText(/no pudimos conectar con rondo/i)).toBeTruthy());

      mockMeState.failuresRemaining = 0;
      fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

      await vi.waitFor(() => expect(screen.getByRole('heading', { name: /hola, federico/i })).toBeTruthy());
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the offline screen (not the backend-waking-up message) when the device itself is offline, and recovers once back online', async () => {
    clerkAuthMock.isSignedIn = true;
    // Never resolves on its own within this test, so bootPhase stays
    // 'pending' the whole time -- isolates the offline-screen assertions
    // from a race against the boot's own retry/success timing.
    mockMeState.failuresRemaining = 999;
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });

    try {
      render(<App />);

      expect(await screen.findByText(/^sin conexión$/i)).toBeTruthy();
      expect(screen.getByText(/rondo necesita conexión para actualizar partidos, invitaciones y mensajes/i)).toBeTruthy();
      expect(screen.queryByText(/estamos iniciando el servidor de rondo/i)).toBeFalsy();
      expect(screen.queryByText(/no pudimos conectar con rondo/i)).toBeFalsy();

      mockMeState.failuresRemaining = 0;
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
      fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));

      await waitFor(() => expect(screen.getByRole('heading', { name: /hola, federico/i })).toBeTruthy());
    } finally {
      Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    }
  });

  it('shows "Partido en juego" (not "Faltan N jugadores") on Home for an IN_PROGRESS match', async () => {
    clerkAuthMock.isSignedIn = true;
    mockMyMatches.push(fixtureMatch({ status: 'IN_PROGRESS', maxPlayers: 10, participantsCount: 3 }));
    render(<App />);
    await screen.findByRole('heading', { name: /hola, federico/i });

    expect(await screen.findByText('Partido en juego')).toBeTruthy();
    expect(screen.queryByText(/faltan \d+ jugadores/i)).toBeFalsy();
  });

  it('shows an EXPIRED match under Partidos finalizados, not Próximos partidos', async () => {
    clerkAuthMock.isSignedIn = true;
    mockMyMatches.push(fixtureMatch({ status: 'EXPIRED', maxPlayers: 10, participantsCount: 3 }));
    render(<App />);
    await screen.findByRole('heading', { name: /hola, federico/i });

    await screen.findByText(/^partidos finalizados$/i);
    expect(screen.getByText('Partido vencido')).toBeTruthy();
    expect(screen.queryByText(/^próximos partidos$/i)).toBeFalsy();
    expect(screen.queryByText(/faltan \d+ jugadores/i)).toBeFalsy();
  });

  it('shows a CANCELLED match under Partidos finalizados, not Próximos partidos', async () => {
    clerkAuthMock.isSignedIn = true;
    mockMyMatches.push(fixtureMatch({ status: 'CANCELLED', maxPlayers: 10, participantsCount: 3 }));
    render(<App />);
    await screen.findByRole('heading', { name: /hola, federico/i });

    await screen.findByText(/^partidos finalizados$/i);
    expect(screen.getByText('Partido cancelado')).toBeTruthy();
    expect(screen.queryByText(/^próximos partidos$/i)).toBeFalsy();
  });

  it('drops a COMPLETED match from Home entirely once it is older than the 24h Partidos finalizados window', async () => {
    clerkAuthMock.isSignedIn = true;
    const staleCompletedAt = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    mockMyMatches.push(fixtureMatch({ status: 'COMPLETED', maxPlayers: 10, participantsCount: 3, statusChangedAt: staleCompletedAt }));
    render(<App />);
    await screen.findByRole('heading', { name: /hola, federico/i });

    await screen.findByRole('button', { name: /armar partido/i });
    expect(screen.queryByText('Partido finalizado')).toBeFalsy();
    expect(screen.queryByText(/^partidos finalizados$/i)).toBeFalsy();
    expect(screen.queryByText(/^próximos partidos$/i)).toBeFalsy();
  });

  it('keeps showing a COMPLETED match under Partidos finalizados within the 24h window', async () => {
    clerkAuthMock.isSignedIn = true;
    const recentCompletedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    mockMyMatches.push(fixtureMatch({ status: 'COMPLETED', maxPlayers: 10, participantsCount: 3, statusChangedAt: recentCompletedAt }));
    render(<App />);
    await screen.findByRole('heading', { name: /hola, federico/i });

    await screen.findByText(/^partidos finalizados$/i);
    expect(screen.getByText('Partido finalizado')).toBeTruthy();
  });

  it('shows "Partido finalizado" (not "Faltan N jugadores") on Home for a COMPLETED match', async () => {
    clerkAuthMock.isSignedIn = true;
    mockMyMatches.push(fixtureMatch({ status: 'COMPLETED', maxPlayers: 10, participantsCount: 3 }));
    render(<App />);
    await screen.findByRole('heading', { name: /hola, federico/i });

    expect(await screen.findByText('Partido finalizado')).toBeTruthy();
    expect(screen.queryByText(/faltan \d+ jugadores/i)).toBeFalsy();
  });

  it('still shows "Faltan N jugadores" for an ORGANIZING match', async () => {
    clerkAuthMock.isSignedIn = true;
    mockMyMatches.push(fixtureMatch({ status: 'ORGANIZING', maxPlayers: 10, participantsCount: 3 }));
    render(<App />);
    await screen.findByRole('heading', { name: /hola, federico/i });

    expect(await screen.findByText('Faltan 7 jugadores')).toBeTruthy();
  });

  it('an IN_PROGRESS or EXPIRED match never generates a pending action (venue/court/time) on the bell', async () => {
    clerkAuthMock.isSignedIn = true;
    mockMyMatches.push(
      fixtureMatch({ id: 'match-in-progress', status: 'IN_PROGRESS', venueType: 'TO_BE_DEFINED', clubId: null, clubName: null, startsAt: null }),
      fixtureMatch({ id: 'match-expired', status: 'EXPIRED', venueType: 'TO_BE_DEFINED', clubId: null, clubName: null, startsAt: null }),
    );
    render(<App />);
    await screen.findByRole('heading', { name: /hola, federico/i });

    await screen.findByText('Partido en juego');
    expect(screen.getByLabelText('Notificaciones')).toBeTruthy();
  });

  it('never shows the push-notifications activation banner on the Login screen', () => {
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: new Promise(() => {}) } });

    try {
      render(<App />);
      expect(screen.queryByText(/activá las notificaciones/i)).toBeFalsy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('shows the push-notifications activation banner once signed in, when the browser supports it', async () => {
    clerkAuthMock.isSignedIn = true;
    // Installing takes priority over activating push (see docs/PWA.md) --
    // mark the install-welcome card already dismissed so it doesn't hide
    // the push banner this test is actually about.
    localStorage.setItem(INSTALL_WELCOME_DISMISSAL_KEY, String(Date.now()));
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn(async () => null) } }) },
    });

    try {
      render(<App />);
      await screen.findByRole('heading', { name: /hola, federico/i });
      expect(await screen.findByText(/activá las notificaciones/i)).toBeTruthy();
    } finally {
      vi.unstubAllGlobals();
      localStorage.removeItem(INSTALL_WELCOME_DISMISSAL_KEY);
    }
  });

  it('never shows the install-welcome card on the Login screen', () => {
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() });
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: new Promise(() => {}) } });

    try {
      render(<App />);
      expect(screen.queryByText(/bienvenido a rondo/i)).toBeFalsy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('clears matches, invitations and club data on logout, and a fresh sign-in never shows the previous account\'s data', async () => {
    // RegisterPage.tsx's onRegister prop resolves to the exact same
    // `setCurrentView('home')` call as LoginPage's onLogin (see App.tsx), and
    // both flip isSignedIn via the same Clerk `finalize()` mock -- so driving
    // this through the login flow twice exercises the identical App.tsx
    // state-cleanup mechanism (resetUserScopedState + useMyClubs/useAdminClubs
    // refetching on isSignedIn) that a logout-then-register sequence would.
    // The register link itself is gated behind VITE_BETA_SIGN_UP_ENABLED,
    // which vite.config.ts pins to 'false' for all tests, so it isn't
    // reachable through the real UI here.
    const originalDisplayName = mockMeProfile.displayName;
    const clubsBackup: UserClubDto[] = mockClubs.slice();
    try {
      mockMyMatches.push(fixtureMatch({ id: 'match-user-a', sportId: 'sport-padel', sportModalityId: 'modality-padel-doubles', sportName: 'Pádel', modalityName: 'Dobles' }));
      mockMyInvitations.push({
        id: 'invitation-user-a',
        matchId: 'match-invite-a',
        status: 'PENDING',
        position: null,
        invitedUserId: 'user-test',
        invitedUserDisplayName: 'Federico Femenia',
        invitedById: 'organizer-1',
        organizerDisplayName: 'Juan Pérez',
        sportName: 'Fútbol',
        modalityName: 'Fútbol 5',
        clubName: null,
        scheduledDate: '2026-08-07',
        availabilityStartMinutes: 20 * 60,
        availabilityEndMinutes: 21 * 60,
        startsAt: null,
        endsAt: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        respondedAt: null,
      });

      await loginAndReachHome();
      expect(screen.getByRole('button', { name: /pádel • dobles/i })).toBeTruthy();
      expect(screen.getByRole('button', { name: /club señor pato/i })).toBeTruthy();

      logout();
      await waitFor(() => expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeTruthy());

      // Simulate a different account signing in on the same tab: the
      // "backend" now returns entirely different matches/invitations/clubs.
      mockMyMatches.length = 0;
      mockMyInvitations.length = 0;
      mockClubs.splice(0, mockClubs.length);
      mockMyMatches.push(fixtureMatch({ id: 'match-user-b' }));
      mockMeProfile.displayName = 'Otro Usuario';

      fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
      await screen.findByRole('heading', { name: /hola, otro usuario/i });

      expect(screen.getByRole('button', { name: /fútbol • fútbol 5/i })).toBeTruthy();
      expect(screen.queryByRole('button', { name: /pádel • dobles/i })).toBeFalsy();
      expect(screen.queryByRole('button', { name: /club señor pato/i })).toBeFalsy();
      expect(screen.queryByText(/juan pérez te invitó/i)).toBeFalsy();
    } finally {
      mockMeProfile.displayName = originalDisplayName;
      mockClubs.splice(0, mockClubs.length, ...clubsBackup);
    }
  });

  it('does not leave stale club data behind when a club-less account logs in right after one that had clubs', async () => {
    await loginAndReachHome();
    expect(screen.getByRole('button', { name: /club señor pato/i })).toBeTruthy();

    logout();
    await waitFor(() => expect(screen.getByRole('button', { name: /iniciar sesión/i })).toBeTruthy());

    const backup = mockClubs.splice(0, mockClubs.length);
    try {
      fireEvent.click(screen.getByRole('button', { name: /iniciar sesión/i }));
      await screen.findByRole('heading', { name: /hola, federico/i });

      expect(screen.queryByRole('button', { name: /club señor pato/i })).toBeFalsy();
      expect(screen.getByText(/todavía no estás asociado a ningún club/i)).toBeTruthy();
    } finally {
      mockClubs.push(...backup);
    }
  });

  it('shows the install-welcome card once signed in, when not already installed or dismissed', async () => {
    clerkAuthMock.isSignedIn = true;
    localStorage.removeItem(INSTALL_WELCOME_DISMISSAL_KEY);
    vi.stubGlobal('PushManager', class {});
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ pushManager: { getSubscription: vi.fn(async () => null) } }) },
    });

    try {
      render(<App />);
      await screen.findByRole('heading', { name: /hola, federico/i });
      expect(await screen.findByText(/bienvenido a rondo/i)).toBeTruthy();
      // Priority 1 (install) over priority 2 (push) -- see docs/PWA.md.
      expect(screen.queryByText(/activá las notificaciones/i)).toBeFalsy();
    } finally {
      vi.unstubAllGlobals();
      localStorage.removeItem(INSTALL_WELCOME_DISMISSAL_KEY);
    }
  });
});
