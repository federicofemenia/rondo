import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RatingsParticipantDto } from '@rondo/contracts';
import MatchRatingsPage from '../src/MatchRatingsPage';

function participant(overrides: Partial<RatingsParticipantDto> = {}): RatingsParticipantDto {
  return {
    userId: 'user-mauro',
    displayName: 'Mauro',
    avatarUrl: null,
    isCurrentUser: false,
    status: 'PENDING',
    rating: null,
    ...overrides,
  };
}

describe('MatchRatingsPage', () => {
  it('shows the informational message before the match is completed', () => {
    render(<MatchRatingsPage status="ORGANIZING" closed={false} />);
    expect(screen.getByText(/las valoraciones se habilitarán cuando finalice el partido/i)).toBeTruthy();
  });

  it('shows a cancelled message and no participant actions', () => {
    render(<MatchRatingsPage status="CANCELLED" closed={false} participants={[participant()]} />);
    expect(screen.getByText(/este partido fue cancelado y no admite valoraciones/i)).toBeTruthy();
    expect(screen.queryByText('Mauro')).toBeFalsy();
  });

  it('shows an expired message and no participant actions', () => {
    render(<MatchRatingsPage status="EXPIRED" closed={false} participants={[participant()]} />);
    expect(screen.getByText(/este partido venció sin completarse y no admite valoraciones/i)).toBeTruthy();
  });

  it('shows a closed message once the 7-day window has passed for a completed match', () => {
    render(<MatchRatingsPage status="COMPLETED" closed participants={[participant()]} />);
    expect(screen.getByText(/el período para valorar este partido finalizó/i)).toBeTruthy();
  });

  it('shows a loading message while ratings are being fetched', () => {
    render(<MatchRatingsPage status="COMPLETED" closed={false} loading participants={[]} />);
    expect(screen.getByText(/cargando valoraciones/i)).toBeTruthy();
  });

  it('lists confirmed participants and the current user as Vos, not selectable', () => {
    render(
      <MatchRatingsPage
        status="COMPLETED"
        closed={false}
        participants={[
          participant({ userId: 'user-mauro', displayName: 'Mauro' }),
          participant({ userId: 'user-lina', displayName: 'Lina' }),
          participant({ userId: 'user-federico', displayName: 'Federico', isCurrentUser: true, status: 'SELF' }),
        ]}
      />,
    );

    expect(screen.getByText('Mauro')).toBeTruthy();
    expect(screen.getByText('Lina')).toBeTruthy();
    expect(screen.getByText('Federico')).toBeTruthy();
    expect(screen.getByText('Vos')).toBeTruthy();
    expect(screen.getAllByText(/pendiente/i)).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: /valorar/i })).toHaveLength(2);
  });

  it('marks an already-rated participant as Valoración enviada and offers Editar', () => {
    render(
      <MatchRatingsPage
        status="COMPLETED"
        closed={false}
        participants={[
          participant({
            userId: 'user-mauro',
            displayName: 'Mauro',
            status: 'COMPLETED',
            rating: { id: 'rating-1', gameplayScore: 5, conductScore: 5, comment: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
          }),
          participant({ userId: 'user-lina', displayName: 'Lina' }),
        ]}
      />,
    );

    expect(screen.getByText(/valoración enviada/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^editar$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^valorar$/i })).toBeTruthy();
  });

  it('opens the modal for a participant and reports the submitted rating', async () => {
    const onRatePlayer = vi.fn();
    render(<MatchRatingsPage status="COMPLETED" closed={false} participants={[participant()]} onRatePlayer={onRatePlayer} />);

    fireEvent.click(screen.getByRole('button', { name: /^valorar$/i }));
    expect(screen.getByText(/valorar a mauro/i)).toBeTruthy();

    fireEvent.click(screen.getAllByRole('radio', { name: '5 Stars' })[0]!);
    fireEvent.click(screen.getAllByRole('radio', { name: '4 Stars' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: /guardar valoración/i }));

    await waitFor(() => expect(onRatePlayer).toHaveBeenCalledWith('user-mauro', { gameplayScore: 5, conductScore: 4, comment: undefined }));
  });
});
