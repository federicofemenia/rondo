import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MatchDetailPage from '../src/MatchDetailPage';
import type { MatchEntity } from '../src/types';

const baseMatch: MatchEntity = {
  id: 'match-1',
  sport: 'Fútbol',
  modality: 'Fútbol 5',
  minPlayers: '4',
  maxPlayers: '10',
  positions: [],
  clubName: 'Club Señor Pato',
  courtName: 'Cancha 2 · Vidrio',
  date: '2026-08-05',
  time: '19:00',
  bookingId: 'booking-1',
  invitedCandidates: [],
  declinedCandidates: [],
  participants: ['Mauro'],
  chatMessages: [],
  ratings: {},
  createdAt: 1,
  cancelledAt: null,
  cancelledByType: null,
  cancelledByName: null,
  cancellationReason: null,
};

describe('MatchDetailPage', () => {
  it('renders the match summary and estado del evento on the datos tab by default', () => {
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    expect(screen.getAllByText(/fútbol/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/club señor pato/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/jugadores 4 - 10/i)).toBeTruthy();
    expect(screen.getByText(/estado del evento/i)).toBeTruthy();
    expect(screen.getByText(/día confirmado/i)).toBeTruthy();
    expect(screen.getByText(/^organizando$/i)).toBeTruthy();
  });

  it('shows reservation actions when the match has no court yet', () => {
    render(<MatchDetailPage match={{ ...baseMatch, courtName: null }} unlinkedBookings={[]} />);

    expect(screen.getByText(/cancha pendiente/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /realizar una reserva/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /asociar una reserva existente/i })).toBeTruthy();
  });

  it('lets the organizer set a pending club directly from the estado del evento card', () => {
    const onEditClub = vi.fn();
    render(<MatchDetailPage match={{ ...baseMatch, clubName: null }} unlinkedBookings={[]} onEditClub={onEditClub} />);

    expect(screen.getByText(/club pendiente/i)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/editar club/i), { target: { value: 'Club Señor Pato' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar cambios/i }));

    expect(onEditClub).toHaveBeenCalledWith('Club Señor Pato');
  });

  it('shows Completo once the match reaches its player cap', () => {
    render(<MatchDetailPage match={{ ...baseMatch, maxPlayers: '1', participants: ['Mauro'] }} unlinkedBookings={[]} />);

    expect(screen.getByText(/^completo$/i)).toBeTruthy();
  });

  it('candidatos tab shows every invited candidate as a read-only status, no accept/decline buttons', () => {
    render(
      <MatchDetailPage
        match={{ ...baseMatch, invitedCandidates: ['Tomás', 'Lina'], participants: ['Mauro', 'Lina'] }}
        unlinkedBookings={[]}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^candidatos$/i }));
    expect(screen.getByText('Tomás')).toBeTruthy();
    expect(screen.getByText(/pendiente de confirmación/i)).toBeTruthy();
    expect(screen.getByText(/^aceptado$/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /aceptar/i })).toBeFalsy();
    expect(screen.queryByRole('button', { name: /rechazar/i })).toBeFalsy();
  });

  it('invitar tab lets the organizer invite more candidates, excluding those already invited', () => {
    const onInviteCandidate = vi.fn();
    render(
      <MatchDetailPage
        match={{ ...baseMatch, invitedCandidates: ['Mauro'] }}
        unlinkedBookings={[]}
        onInviteCandidate={onInviteCandidate}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /^invitar$/i }));
    expect(screen.queryByText(/^mauro$/i)).toBeFalsy();
    expect(screen.getByText('Lina')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^invitar$/i }));
    expect(onInviteCandidate).toHaveBeenCalledWith('Lina');
  });

  it('gestión tab only lists confirmed participants and can remove or cancel', () => {
    const onRemoveParticipant = vi.fn();
    const onCancelMatch = vi.fn();
    render(
      <MatchDetailPage
        match={baseMatch}
        unlinkedBookings={[]}
        onRemoveParticipant={onRemoveParticipant}
        onCancelMatch={onCancelMatch}
      />,
    );

    fireEvent.click(screen.getByRole('tab', { name: /gestión/i }));
    expect(screen.getByText('Mauro')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /confirmar partido/i })).toBeFalsy();

    fireEvent.click(screen.getByRole('button', { name: /quitar/i }));
    expect(onRemoveParticipant).toHaveBeenCalledWith('Mauro');

    fireEvent.click(screen.getByRole('button', { name: /cancelar partido/i }));
    expect(onCancelMatch).toHaveBeenCalled();
  });

  it('the valoraciones tab is always present, next to Gestión, Candidatos and Chat', () => {
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    expect(screen.getByRole('tab', { name: /^invitar$/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^candidatos$/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /gestión/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /^chat$/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /valoraciones/i })).toBeTruthy();
  });

  it('shows the informational message on the valoraciones tab before the match finishes', () => {
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    fireEvent.click(screen.getByRole('tab', { name: /valoraciones/i }));
    expect(screen.getByText(/las valoraciones se habilitarán cuando finalice el partido/i)).toBeTruthy();
  });

  it('shows a cancelled match banner, hides organizing tabs, and blocks ratings', () => {
    render(
      <MatchDetailPage
        match={{
          ...baseMatch,
          cancelledAt: '2026-07-30T18:30:00.000Z',
          cancelledByType: 'USER',
          cancelledByName: 'Federico',
        }}
        unlinkedBookings={[]}
      />,
    );

    expect(screen.getByText(/partido cancelado/i)).toBeTruthy();
    expect(screen.getByText(/cancelado por federico/i)).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /^invitar$/i })).toBeFalsy();
    expect(screen.queryByRole('tab', { name: /^candidatos$/i })).toBeFalsy();
    expect(screen.queryByRole('tab', { name: /gestión/i })).toBeFalsy();
    expect(screen.queryByRole('tab', { name: /^chat$/i })).toBeFalsy();

    fireEvent.click(screen.getByRole('tab', { name: /valoraciones/i }));
    expect(screen.getByText(/este partido fue cancelado y no admite valoraciones/i)).toBeTruthy();
  });

  it('shows an automatic-system message when the match was cancelled without a user', () => {
    render(
      <MatchDetailPage
        match={{ ...baseMatch, cancelledAt: '2026-07-30T18:30:00.000Z', cancelledByType: 'SYSTEM', cancelledByName: null }}
        unlinkedBookings={[]}
      />,
    );

    expect(screen.getByText(/actualizado automáticamente por el sistema/i)).toBeTruthy();
  });
});
