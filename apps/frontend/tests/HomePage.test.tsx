import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '../src/HomePage';
import type { MatchInvitationDto } from '@rondo/contracts';

const pendingInvitation: MatchInvitationDto = {
  id: 'invitation-1',
  matchId: 'match-1',
  status: 'PENDING',
  position: null,
  invitedUserId: 'user-test',
  invitedUserDisplayName: 'Federico Femenia',
  invitedById: 'organizer-1',
  organizerDisplayName: 'Federico',
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
};

describe('HomePage', () => {
  it('does not show an Invitaciones pendientes section when there are none', () => {
    render(<HomePage />);

    expect(screen.queryByText(/invitaciones pendientes/i)).toBeFalsy();
  });

  it('shows each pending invitation with organizer, sport, schedule, venue and Aceptar/Rechazar actions', () => {
    render(<HomePage pendingInvitations={[pendingInvitation]} />);

    expect(screen.getByText(/invitaciones pendientes/i)).toBeTruthy();
    expect(screen.getByText(/federico te invitó a fútbol fútbol 5/i)).toBeTruthy();
    expect(screen.getByText('Sede a definir')).toBeTruthy();
    expect(screen.getByRole('button', { name: /^aceptar$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^rechazar$/i })).toBeTruthy();
  });

  it('shows the club name instead of "Sede a definir" when the match has a venue', () => {
    render(<HomePage pendingInvitations={[{ ...pendingInvitation, clubName: 'Club Señor Pato' }]} />);

    expect(screen.getByText('Club Señor Pato')).toBeTruthy();
    expect(screen.queryByText('Sede a definir')).toBeFalsy();
  });

  it('calls onAcceptInvitation / onRejectInvitation with the invitation id', () => {
    const onAcceptInvitation = vi.fn();
    const onRejectInvitation = vi.fn();
    render(
      <HomePage pendingInvitations={[pendingInvitation]} onAcceptInvitation={onAcceptInvitation} onRejectInvitation={onRejectInvitation} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /^aceptar$/i }));
    expect(onAcceptInvitation).toHaveBeenCalledWith('invitation-1');

    fireEvent.click(screen.getByRole('button', { name: /^rechazar$/i }));
    expect(onRejectInvitation).toHaveBeenCalledWith('invitation-1');
  });

  it('disables both buttons and shows a sending state while responding to that invitation', () => {
    render(<HomePage pendingInvitations={[pendingInvitation]} respondingInvitationId="invitation-1" />);

    expect(screen.getByRole('button', { name: /enviando/i })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: /^rechazar$/i })).toHaveProperty('disabled', true);
  });

  it('shows the backend error message for a failed response, scoped to that invitation', () => {
    render(<HomePage pendingInvitations={[pendingInvitation]} invitationRespondErrors={{ 'invitation-1': 'No pudimos procesar tu respuesta.' }} />);

    expect(screen.getByText(/no pudimos procesar tu respuesta/i)).toBeTruthy();
  });

  it('shows the informational Clubes card when the user has no active club membership', () => {
    render(<HomePage clubName={null} />);

    expect(screen.getByText('Clubes')).toBeTruthy();
    expect(screen.getByText(/todavía no estás asociado a ningún club/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /buscar club/i })).toBeTruthy();
  });

  it('does not show club novedades/banner/club-selector content when the user has no active club', () => {
    render(<HomePage clubName={null} />);

    expect(screen.queryByText(/novedades de/i)).toBeFalsy();
    expect(screen.queryByText(/% off/i)).toBeFalsy();
    expect(screen.queryByRole('button', { name: /club señor pato/i })).toBeFalsy();
  });

  it('does not show the Clubes card when the user has an active club membership', () => {
    render(<HomePage clubName="Club Señor Pato" />);

    expect(screen.queryByText('Clubes')).toBeFalsy();
    expect(screen.queryByText(/todavía no estás asociado a ningún club/i)).toBeFalsy();
  });

  it('keeps showing the club badge and novedades for a user with an active club membership', () => {
    render(<HomePage clubName="Club Señor Pato" />);

    expect(screen.getByRole('button', { name: /club señor pato/i })).toBeTruthy();
    expect(screen.getByText(/novedades de club señor pato/i)).toBeTruthy();
  });
});
