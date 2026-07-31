import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MatchInvitationDto } from '@rondo/contracts';
import InvitationsPage from '../src/InvitationsPage';
import { mockInvitationRespondFailingIds, mockMyInvitations } from './setup';

const pendingInvitation: MatchInvitationDto = {
  id: 'invitation-1',
  matchId: 'match-1',
  status: 'PENDING',
  position: 'Arquero',
  invitedUserId: 'user-test',
  invitedUserDisplayName: 'Federico Femenia',
  invitedById: 'organizer-1',
  organizerDisplayName: 'Juan Pérez',
  sportName: 'Fútbol',
  modalityName: 'Fútbol 5',
  clubName: 'Club Señor Pato',
  scheduledDate: '2026-08-05',
  availabilityStartMinutes: 17 * 60,
  availabilityEndMinutes: 22 * 60,
  startsAt: null,
  endsAt: null,
  createdAt: '2026-08-01T00:00:00.000Z',
  respondedAt: null,
};

describe('InvitationsPage', () => {
  it('shows a loading state while invitations are being fetched', () => {
    render(<InvitationsPage />);

    expect(screen.getByRole('progressbar')).toBeTruthy();
  });

  it('shows an empty state when there are no invitations', async () => {
    render(<InvitationsPage />);

    expect(await screen.findByText(/todavía no tenés invitaciones/i)).toBeTruthy();
  });

  it('renders a pending invitation with organizer, sport, schedule and status, plus accept/reject actions', async () => {
    mockMyInvitations.push({ ...pendingInvitation });
    render(<InvitationsPage />);

    expect(await screen.findByText(/fútbol • fútbol 5/i)).toBeTruthy();
    expect(screen.getByText(/organiza juan pérez/i)).toBeTruthy();
    expect(screen.getByText(/club señor pato/i)).toBeTruthy();
    expect(screen.getByText(/pendiente de confirmación/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^aceptar$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^rechazar$/i })).toBeTruthy();
  });

  it('does not show accept/reject actions for an already-answered invitation', async () => {
    mockMyInvitations.push({ ...pendingInvitation, status: 'ACCEPTED', respondedAt: '2026-08-01T01:00:00.000Z' });
    render(<InvitationsPage />);

    await screen.findByText(/fútbol • fútbol 5/i);
    expect(screen.getByText(/^aceptada$/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^aceptar$/i })).toBeFalsy();
    expect(screen.queryByRole('button', { name: /^rechazar$/i })).toBeFalsy();
  });

  it('shows a Ver partido button for an accepted invitation and navigates to its match', async () => {
    mockMyInvitations.push({ ...pendingInvitation, status: 'ACCEPTED', respondedAt: '2026-08-01T01:00:00.000Z' });
    const onViewMatch = vi.fn();
    render(<InvitationsPage onViewMatch={onViewMatch} />);

    fireEvent.click(await screen.findByRole('button', { name: /ver partido/i }));

    expect(onViewMatch).toHaveBeenCalledWith('match-1');
  });

  it('does not show a Ver partido button when onViewMatch is not provided', async () => {
    mockMyInvitations.push({ ...pendingInvitation, status: 'ACCEPTED', respondedAt: '2026-08-01T01:00:00.000Z' });
    render(<InvitationsPage />);

    await screen.findByText(/^aceptada$/i);
    expect(screen.queryByRole('button', { name: /ver partido/i })).toBeFalsy();
  });

  it('does not show a Ver partido button for a pending invitation even when onViewMatch is provided', async () => {
    mockMyInvitations.push({ ...pendingInvitation });
    render(<InvitationsPage onViewMatch={vi.fn()} />);

    await screen.findByText(/pendiente de confirmación/i);
    expect(screen.queryByRole('button', { name: /ver partido/i })).toBeFalsy();
  });

  it('accepts an invitation and updates its status in place', async () => {
    mockMyInvitations.push({ ...pendingInvitation });
    const onRespond = vi.fn();
    render(<InvitationsPage onRespond={onRespond} />);

    fireEvent.click(await screen.findByRole('button', { name: /^aceptar$/i }));

    expect(await screen.findByText(/^aceptada$/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^aceptar$/i })).toBeFalsy();
    expect(onRespond).toHaveBeenCalled();
  });

  it('rejects an invitation and updates its status in place', async () => {
    mockMyInvitations.push({ ...pendingInvitation });
    render(<InvitationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /^rechazar$/i }));

    expect(await screen.findByText(/^rechazada$/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^rechazar$/i })).toBeFalsy();
  });

  it('shows the backend error message when responding fails', async () => {
    mockMyInvitations.push({ ...pendingInvitation });
    mockInvitationRespondFailingIds.add(pendingInvitation.id);
    render(<InvitationsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /^aceptar$/i }));

    expect(await screen.findByText(/ocurrió un error inesperado/i)).toBeTruthy();
  });

  it('calls onBack when the back button is clicked', async () => {
    const onBack = vi.fn();
    render(<InvitationsPage onBack={onBack} />);
    await screen.findByText(/todavía no tenés invitaciones/i);

    fireEvent.click(screen.getByRole('button', { name: /volver/i }));

    expect(onBack).toHaveBeenCalled();
  });
});
