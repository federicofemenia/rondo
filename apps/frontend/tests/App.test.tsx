import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { clerkAuthMock, mockClubs, mockMeState, mockMyInvitations } from './setup';

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

  it('renders the home dashboard with the primary quick actions and empty state after logging in', async () => {
    await loginAndReachHome();

    expect(screen.getByRole('heading', { name: /hola, federico/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /club señor pato/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /armar partido/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /reservar cancha/i })).toBeTruthy();
    expect(screen.getByText(/todavía no tenés partidos ni reservas/i)).toBeTruthy();
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
    // task" in that case.
    fireEvent.click(screen.getByLabelText(/notificaciones/i));
    expect(screen.getByText(/todavía no tiene sede/i)).toBeTruthy();
    expect(screen.queryByText(/todavía no tiene cancha/i)).toBeFalsy();
    fireEvent.keyDown(screen.getByText(/todavía no tiene sede/i), { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByText(/todavía no tiene sede/i)).toBeFalsy());

    fireEvent.click(screen.getByRole('button', { name: /fútbol • fútbol 5/i }));

    expect(screen.getByRole('tab', { name: /^resumen$/i })).toBeTruthy();
    expect(screen.getByText(/sede pendiente de confirmación/i)).toBeTruthy();
    expect(screen.queryByText(/cancha pendiente/i)).toBeFalsy();
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
      await vi.waitFor(() => expect(screen.getByText(/invitaciones pendientes/i)).toBeTruthy());
      expect(screen.getByText(/juan pérez te invitó a fútbol fútbol 5/i)).toBeTruthy();
      expect(screen.getByText(/sede a definir/i)).toBeTruthy();

      fireEvent.click(screen.getByRole('button', { name: /^aceptar$/i }));

      await vi.waitFor(() => expect(screen.queryByText(/invitaciones pendientes/i)).toBeFalsy());
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
      await vi.waitFor(() => expect(screen.getByText(/invitaciones pendientes/i)).toBeTruthy());

      fireEvent.click(screen.getByRole('button', { name: /^rechazar$/i }));

      await vi.waitFor(() => expect(screen.queryByText(/invitaciones pendientes/i)).toBeFalsy());
      expect(screen.getByText(/todavía no tenés partidos ni reservas/i)).toBeTruthy();
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
});
