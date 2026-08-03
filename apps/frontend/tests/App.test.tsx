import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { clerkAuthMock, mockMeState, mockMyInvitations } from './setup';

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

  it('completes the wizard, shows the match on Home, and opens its detail with pending status', async () => {
    await loginAndReachHome();

    fireEvent.click(screen.getByRole('button', { name: /armar partido/i }));
    await screen.findByText('Delantero');
    fireEvent.click(screen.getByRole('button', { name: /^armar partido$/i }));

    expect(await screen.findByRole('heading', { name: /candidatos compatibles/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /finalizar/i }));

    await screen.findByRole('heading', { name: /hola, federico/i });
    expect(screen.queryByText(/tenés una reserva sin partido asociado/i)).toBeFalsy();

    fireEvent.click(screen.getByLabelText(/notificaciones/i));
    expect(screen.getByText(/todavía no tiene cancha/i)).toBeTruthy();
    fireEvent.keyDown(screen.getByText(/todavía no tiene cancha/i), { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByText(/todavía no tiene cancha/i)).toBeFalsy());

    fireEvent.click(screen.getByRole('button', { name: /fútbol • fútbol 5/i }));

    expect(screen.getByRole('tab', { name: /^resumen$/i })).toBeTruthy();
    expect(screen.getByText(/cancha pendiente/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /realizar una reserva/i })).toBeTruthy();
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
