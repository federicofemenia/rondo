import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MatchRatingsPage from '../src/MatchRatingsPage';

describe('MatchRatingsPage', () => {
  it('renders the ratings form with both dimensions', () => {
    render(<MatchRatingsPage />);

    expect(screen.getByRole('heading', { name: /valoraciones/i })).toBeTruthy();
    expect(screen.getAllByText(/calificar/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/conducta/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/cómo jugó/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/comentario/i).length).toBeGreaterThan(0);
  });

  it('submits conduct, skill and an optional comment for a player', () => {
    const onRatePlayer = vi.fn();
    render(<MatchRatingsPage onRatePlayer={onRatePlayer} />);

    fireEvent.change(screen.getAllByLabelText(/conducta/i)[0]!, { target: { value: '3' } });
    fireEvent.change(screen.getAllByLabelText(/cómo jugó/i)[0]!, { target: { value: '2' } });
    fireEvent.change(screen.getAllByLabelText(/comentario/i)[0]!, { target: { value: 'Muy buena onda' } });
    fireEvent.click(screen.getAllByRole('button', { name: /calificar/i })[0]!);

    expect(onRatePlayer).toHaveBeenCalledWith('Mauro', { conduct: 3, skill: 2, comment: 'Muy buena onda' });
  });
});
