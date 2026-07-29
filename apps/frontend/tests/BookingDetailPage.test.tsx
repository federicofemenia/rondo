import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BookingDetailPage from '../src/BookingDetailPage';
import type { BookingEntity } from '../src/types';

const baseBooking: BookingEntity = {
  id: 'booking-1',
  clubName: 'Club Señor Pato',
  courtName: 'Cancha 2',
  courtSubtitle: 'Vidrio',
  dateLabel: 'Mié 28 May',
  time: '10:00',
  matchId: null,
  createdAt: 1,
};

describe('BookingDetailPage', () => {
  it('shows the sin partido asociado state with its actions', () => {
    const onCreateMatch = vi.fn();
    const onAssociateMatch = vi.fn();
    render(
      <BookingDetailPage
        booking={baseBooking}
        unlinkedMatches={[{ id: 'match-1', title: 'Fútbol • Fútbol 5', subtitle: 'Club Señor Pato' }]}
        onCreateMatch={onCreateMatch}
        onAssociateMatch={onAssociateMatch}
      />,
    );

    expect(screen.getByText(/sin partido asociado/i)).toBeTruthy();
    expect(screen.getByText(/cancha 2/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^crear partido$/i }));
    expect(onCreateMatch).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /asociar partido existente/i }));
    fireEvent.click(screen.getByText(/fútbol • fútbol 5/i));
    expect(onAssociateMatch).toHaveBeenCalledWith('match-1');
  });

  it('shows the linked match summary when the booking has a partido asociado', () => {
    render(
      <BookingDetailPage
        booking={{ ...baseBooking, matchId: 'match-1' }}
        linkedMatchSummary={{ sport: 'Fútbol', modality: 'Fútbol 5' }}
        unlinkedMatches={[]}
      />,
    );

    expect(screen.getByText(/partido asociado/i)).toBeTruthy();
    expect(screen.getByText(/fútbol • fútbol 5/i)).toBeTruthy();
    expect(screen.queryByText(/sin partido asociado/i)).toBeFalsy();
  });
});
