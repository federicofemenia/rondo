import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchParticipantsResponseDto } from '@rondo/contracts';
import MatchPlayersPage from '../src/MatchPlayersPage';
import {
  mockCancelInvitationFailingIds,
  mockLeaveMatchFailingMatchIds,
  mockParticipantsByMatchId,
  mockParticipantsFailingMatchIds,
  mockRemoveParticipantFailingUserIds,
} from './setup';

const fullRoster: MatchParticipantsResponseDto = {
  organizer: { userId: 'user-organizer', displayName: 'Federico Femenia', avatarUrl: null },
  confirmed: [{ userId: 'user-mauro', displayName: 'Mauro', avatarUrl: null }],
  pending: [
    { invitationId: 'invitation-1', userId: 'user-lina', displayName: 'Lina', avatarUrl: null, position: 'Defensor', createdAt: '2026-07-20T10:00:00.000Z' },
  ],
  rejected: [{ invitationId: 'invitation-2', userId: 'user-tomas', displayName: 'Tomás', avatarUrl: null, respondedAt: '2026-07-18T10:00:00.000Z' }],
};

describe('MatchPlayersPage', () => {
  it('shows the counter, the roster grouped by organizer/confirmed/pending/rejected, and Quedan N lugares', async () => {
    mockParticipantsByMatchId.set('match-1', structuredClone(fullRoster));
    render(
      <MatchPlayersPage matchId="match-1" isOrganizer status="ORGANIZING" participantsCount={7} maxPlayers={10} />,
    );

    expect(screen.getByText('7 / 10 confirmados')).toBeTruthy();
    expect(screen.getByText(/quedan 3 lugares/i)).toBeTruthy();

    await screen.findByText('Federico Femenia');
    expect(screen.getByText('1 invitación pendiente')).toBeTruthy();
    expect(screen.getByText(/confirmados \(1\)/i)).toBeTruthy();
    expect(screen.getByText('Mauro')).toBeTruthy();
    expect(screen.getByText('Lina')).toBeTruthy();
    expect(screen.getByText(/tomás/i)).toBeTruthy();
  });

  it('shows Equipo completo and hides Buscar jugadores when the match is FULL', async () => {
    mockParticipantsByMatchId.set('match-1', structuredClone(fullRoster));
    render(<MatchPlayersPage matchId="match-1" isOrganizer status="FULL" participantsCount={10} maxPlayers={10} />);

    await screen.findByText('Federico Femenia');
    expect(screen.getByText(/equipo completo/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /buscar jugadores/i })).toBeFalsy();
  });

  it('calls onSearchPlayers when the organizer clicks Buscar jugadores', async () => {
    mockParticipantsByMatchId.set('match-1', structuredClone(fullRoster));
    const onSearchPlayers = vi.fn();
    render(
      <MatchPlayersPage
        matchId="match-1"
        isOrganizer
        status="ORGANIZING"
        participantsCount={7}
        maxPlayers={10}
        onSearchPlayers={onSearchPlayers}
      />,
    );

    await screen.findByText('Federico Femenia');
    fireEvent.click(screen.getByRole('button', { name: /buscar jugadores/i }));
    expect(onSearchPlayers).toHaveBeenCalled();
  });

  it('lets the organizer remove a confirmed participant and updates the list immediately', async () => {
    mockParticipantsByMatchId.set('match-1', structuredClone(fullRoster));
    const onRosterChanged = vi.fn();
    render(
      <MatchPlayersPage
        matchId="match-1"
        isOrganizer
        status="ORGANIZING"
        participantsCount={7}
        maxPlayers={10}
        onRosterChanged={onRosterChanged}
      />,
    );

    await screen.findByText('Mauro');
    fireEvent.click(screen.getByRole('button', { name: /quitar/i }));

    await waitFor(() => expect(screen.queryByText('Mauro')).toBeFalsy());
    expect(onRosterChanged).toHaveBeenCalled();
  });

  it('shows an inline error when removing a participant fails, without removing them from the list', async () => {
    mockParticipantsByMatchId.set('match-1', structuredClone(fullRoster));
    mockRemoveParticipantFailingUserIds.add('user-mauro');
    render(<MatchPlayersPage matchId="match-1" isOrganizer status="ORGANIZING" participantsCount={7} maxPlayers={10} />);

    await screen.findByText('Mauro');
    fireEvent.click(screen.getByRole('button', { name: /quitar/i }));

    await waitFor(() => expect(screen.getByText(/ocurrió un error inesperado/i)).toBeTruthy());
    expect(screen.getByText('Mauro')).toBeTruthy();
  });

  it('lets the organizer cancel a pending invitation and it disappears immediately', async () => {
    mockParticipantsByMatchId.set('match-1', structuredClone(fullRoster));
    render(<MatchPlayersPage matchId="match-1" isOrganizer status="ORGANIZING" participantsCount={7} maxPlayers={10} />);

    await screen.findByText('Lina');
    fireEvent.click(screen.getByRole('button', { name: /cancelar invitación/i }));

    await waitFor(() => expect(screen.queryByText('Lina')).toBeFalsy());
  });

  it('shows an inline error when cancelling an invitation fails', async () => {
    mockParticipantsByMatchId.set('match-1', structuredClone(fullRoster));
    mockCancelInvitationFailingIds.add('invitation-1');
    render(<MatchPlayersPage matchId="match-1" isOrganizer status="ORGANIZING" participantsCount={7} maxPlayers={10} />);

    await screen.findByText('Lina');
    fireEvent.click(screen.getByRole('button', { name: /cancelar invitación/i }));

    await waitFor(() => expect(screen.getByText(/ocurrió un error inesperado/i)).toBeTruthy());
    expect(screen.getByText('Lina')).toBeTruthy();
  });

  it('does not show organizer-only actions to a non-organizer participant, and lets them leave the match', async () => {
    mockParticipantsByMatchId.set('match-1', structuredClone(fullRoster));
    const onLeftMatch = vi.fn();
    render(
      <MatchPlayersPage
        matchId="match-1"
        isOrganizer={false}
        status="ORGANIZING"
        participantsCount={7}
        maxPlayers={10}
        onLeftMatch={onLeftMatch}
      />,
    );

    await screen.findByText('Mauro');
    expect(screen.queryByRole('button', { name: /quitar/i })).toBeFalsy();
    expect(screen.queryByRole('button', { name: /cancelar invitación/i })).toBeFalsy();
    expect(screen.queryByRole('button', { name: /buscar jugadores/i })).toBeFalsy();

    fireEvent.click(screen.getByRole('button', { name: /abandonar partido/i }));
    await waitFor(() => expect(onLeftMatch).toHaveBeenCalled());
  });

  it('shows an inline error when leaving fails and does not call onLeftMatch', async () => {
    mockParticipantsByMatchId.set('match-1', structuredClone(fullRoster));
    mockLeaveMatchFailingMatchIds.add('match-1');
    const onLeftMatch = vi.fn();
    render(
      <MatchPlayersPage
        matchId="match-1"
        isOrganizer={false}
        status="ORGANIZING"
        participantsCount={7}
        maxPlayers={10}
        onLeftMatch={onLeftMatch}
      />,
    );

    await screen.findByText('Mauro');
    fireEvent.click(screen.getByRole('button', { name: /abandonar partido/i }));

    await waitFor(() => expect(screen.getByText(/ocurrió un error inesperado/i)).toBeTruthy());
    expect(onLeftMatch).not.toHaveBeenCalled();
  });

  it('refreshes the roster automatically on a background poll', async () => {
    mockParticipantsByMatchId.set('match-1', structuredClone(fullRoster));
    vi.useFakeTimers();
    try {
      render(<MatchPlayersPage matchId="match-1" isOrganizer status="ORGANIZING" participantsCount={7} maxPlayers={10} />);
      await vi.waitFor(() => expect(screen.getByText('Mauro')).toBeTruthy());

      mockParticipantsByMatchId.get('match-1')!.confirmed.push({ userId: 'user-nuevo', displayName: 'Nuevo Jugador', avatarUrl: null });

      await vi.advanceTimersByTimeAsync(20_000);
      await vi.waitFor(() => expect(screen.getByText('Nuevo Jugador')).toBeTruthy());
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the roster visible when a background poll fails', async () => {
    mockParticipantsByMatchId.set('match-1', structuredClone(fullRoster));
    vi.useFakeTimers();
    try {
      render(<MatchPlayersPage matchId="match-1" isOrganizer status="ORGANIZING" participantsCount={7} maxPlayers={10} />);
      await vi.waitFor(() => expect(screen.getByText('Mauro')).toBeTruthy());

      mockParticipantsFailingMatchIds.add('match-1');

      await vi.advanceTimersByTimeAsync(20_000);
      expect(screen.getByText('Mauro')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides Abandonar partido and roster edit actions once the match is no longer editable', async () => {
    mockParticipantsByMatchId.set('match-1', structuredClone(fullRoster));
    render(<MatchPlayersPage matchId="match-1" isOrganizer={false} status="IN_PROGRESS" participantsCount={7} maxPlayers={10} />);

    await screen.findByText('Mauro');
    expect(screen.queryByRole('button', { name: /abandonar partido/i })).toBeFalsy();
  });
});
