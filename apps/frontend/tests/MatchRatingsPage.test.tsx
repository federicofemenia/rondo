import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MatchRatingsPage from '../src/MatchRatingsPage';

describe('MatchRatingsPage', () => {
  it('shows the informational message before the match is completed', () => {
    render(<MatchRatingsPage status="ORGANIZING" ratingsOpen={false} />);
    expect(screen.getByText(/las valoraciones se habilitarán cuando finalice el partido/i)).toBeTruthy();
  });

  it('shows a cancelled message and no participant actions', () => {
    render(<MatchRatingsPage status="CANCELLED" ratingsOpen={false} participants={['Mauro']} />);
    expect(screen.getByText(/este partido fue cancelado y no admite valoraciones/i)).toBeTruthy();
    expect(screen.queryByText('Mauro')).toBeFalsy();
  });

  it('shows an expired message and no participant actions', () => {
    render(<MatchRatingsPage status="EXPIRED" ratingsOpen={false} participants={['Mauro']} />);
    expect(screen.getByText(/este partido venció sin completarse y no admite valoraciones/i)).toBeTruthy();
  });

  it('shows a closed message once the 7-day window has passed for a completed match', () => {
    render(<MatchRatingsPage status="COMPLETED" ratingsOpen={false} participants={['Mauro']} />);
    expect(screen.getByText(/el período para valorar este partido finalizó/i)).toBeTruthy();
  });

  it('lists confirmed participants and the current user as Vos, not selectable', () => {
    render(<MatchRatingsPage status="COMPLETED" ratingsOpen participants={['Mauro', 'Lina']} currentUserName="Federico" />);

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
        ratingsOpen
        participants={['Mauro', 'Lina']}
        ratings={{ Mauro: { gameplayScore: 5, conductScore: 5 } }}
      />,
    );

    expect(screen.getByText(/valoración enviada/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^editar$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^valorar$/i })).toBeTruthy();
  });

  it('opens the modal for a participant and reports the submitted rating', () => {
    const onRatePlayer = vi.fn();
    render(<MatchRatingsPage status="COMPLETED" ratingsOpen participants={['Mauro']} onRatePlayer={onRatePlayer} />);

    fireEvent.click(screen.getByRole('button', { name: /^valorar$/i }));
    expect(screen.getByText(/valorar a mauro/i)).toBeTruthy();

    fireEvent.click(screen.getAllByRole('radio', { name: '5 Stars' })[0]!);
    fireEvent.click(screen.getAllByRole('radio', { name: '4 Stars' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: /guardar valoración/i }));

    expect(onRatePlayer).toHaveBeenCalledWith('Mauro', { gameplayScore: 5, conductScore: 4, comment: undefined });
  });
});
