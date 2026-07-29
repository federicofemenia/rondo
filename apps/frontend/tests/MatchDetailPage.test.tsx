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
  participants: ['Mauro'],
  chatMessages: [],
  matchFinished: false,
  ratings: {},
  createdAt: 1,
};

describe('MatchDetailPage', () => {
  it('renders the match summary and estado del evento on the datos tab by default', () => {
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    expect(screen.getAllByText(/fútbol/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/club señor pato/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/jugadores 4 - 10/i)).toBeTruthy();
    expect(screen.getByText(/estado del evento/i)).toBeTruthy();
    expect(screen.getByText(/día confirmado/i)).toBeTruthy();
  });

  it('shows reservation actions when the match has no court yet', () => {
    render(<MatchDetailPage match={{ ...baseMatch, courtName: null }} unlinkedBookings={[]} />);

    expect(screen.getByText(/cancha pendiente/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /realizar una reserva/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /asociar una reserva existente/i })).toBeTruthy();
  });

  it('switches to the gestión tab and can finish the match', () => {
    const onFinishMatch = vi.fn();
    render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} onFinishMatch={onFinishMatch} />);

    fireEvent.click(screen.getByRole('tab', { name: /gestión/i }));
    fireEvent.click(screen.getByRole('button', { name: /finalizar partido/i }));

    expect(onFinishMatch).toHaveBeenCalled();
  });

  it('only shows the valoraciones tab once the match is finished', () => {
    const { rerender } = render(<MatchDetailPage match={baseMatch} unlinkedBookings={[]} />);

    expect(screen.queryByRole('tab', { name: /valoraciones/i })).toBeFalsy();

    rerender(<MatchDetailPage match={{ ...baseMatch, matchFinished: true }} unlinkedBookings={[]} />);

    expect(screen.getByRole('tab', { name: /valoraciones/i })).toBeTruthy();
  });
});
