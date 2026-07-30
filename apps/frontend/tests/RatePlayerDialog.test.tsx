import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RatePlayerDialog from '../src/RatePlayerDialog';

describe('RatePlayerDialog', () => {
  it('disables Guardar until both gameplay and conduct scores are set', () => {
    render(<RatePlayerDialog open playerName="Lina" onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.getByRole('button', { name: /guardar valoración/i })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getAllByRole('radio', { name: '4 Stars' })[0]!);
    expect(screen.getByRole('button', { name: /guardar valoración/i })).toHaveProperty('disabled', true);

    fireEvent.click(screen.getAllByRole('radio', { name: '4 Stars' })[1]!);
    expect(screen.getByRole('button', { name: /guardar valoración/i })).toHaveProperty('disabled', false);
  });

  it('truncates the comment at 300 characters', () => {
    render(<RatePlayerDialog open playerName="Lina" onClose={vi.fn()} onSubmit={vi.fn()} />);

    const textarea = screen.getByLabelText(/comentario/i);
    fireEvent.change(textarea, { target: { value: 'a'.repeat(400) } });

    expect((textarea as HTMLTextAreaElement).value).toHaveLength(300);
    expect(screen.getByText('300/300')).toBeTruthy();
  });

  it('submits the selected scores and trimmed comment, then closes', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<RatePlayerDialog open playerName="Lina" onClose={onClose} onSubmit={onSubmit} />);

    fireEvent.click(screen.getAllByRole('radio', { name: '5 Stars' })[0]!);
    fireEvent.click(screen.getAllByRole('radio', { name: '4 Stars' })[1]!);
    fireEvent.change(screen.getByLabelText(/comentario/i), { target: { value: '  Excelente compañera  ' } });
    fireEvent.click(screen.getByRole('button', { name: /guardar valoración/i }));

    await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ gameplayScore: 5, conductScore: 4, comment: 'Excelente compañera' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('pre-fills an existing rating so it can be edited', () => {
    render(
      <RatePlayerDialog
        open
        playerName="Lina"
        initialRating={{ gameplayScore: 3, conductScore: 2, comment: 'Che bien' }}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('radio', { name: '3 Stars', checked: true })[0]).toBeTruthy();
    expect(screen.getAllByRole('radio', { name: '2 Stars', checked: true })[0]).toBeTruthy();
    expect(screen.getByDisplayValue('Che bien')).toBeTruthy();
  });

  it('shows the backend error message when submitting fails', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('El período para valorar este partido finalizó.'));
    render(<RatePlayerDialog open playerName="Lina" onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getAllByRole('radio', { name: '5 Stars' })[0]!);
    fireEvent.click(screen.getAllByRole('radio', { name: '5 Stars' })[1]!);
    fireEvent.click(screen.getByRole('button', { name: /guardar valoración/i }));

    await screen.findByText(/el período para valorar este partido finalizó/i);
  });
});
