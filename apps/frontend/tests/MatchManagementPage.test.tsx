import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MatchManagementPage from '../src/MatchManagementPage';

describe('MatchManagementPage', () => {
  it('shows an empty state and the cancelar action when there are no confirmed players', () => {
    render(<MatchManagementPage />);

    expect(screen.getByRole('heading', { name: /gestión del partido/i })).toBeTruthy();
    expect(screen.getByText(/todavía no hay jugadores confirmados/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /cancelar partido/i })).toBeTruthy();
    expect(screen.queryByText(/confirmar partido/i)).toBeFalsy();
    expect(screen.queryByText(/finalizar partido/i)).toBeFalsy();
  });

  it('lists confirmed participants with a quitar action', () => {
    const onRemoveParticipant = vi.fn();
    render(<MatchManagementPage participants={['Mauro', 'Lina']} onRemoveParticipant={onRemoveParticipant} />);

    expect(screen.getByText('Mauro')).toBeTruthy();
    expect(screen.getByText('Lina')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /quitar/i }).length).toBe(2);

    fireEvent.click(screen.getAllByRole('button', { name: /quitar/i })[0]!);

    expect(onRemoveParticipant).toHaveBeenCalledWith('Mauro');
  });

  it('calls onCancelMatch when cancelar partido is clicked', () => {
    const onCancelMatch = vi.fn();
    render(<MatchManagementPage onCancelMatch={onCancelMatch} />);

    fireEvent.click(screen.getByRole('button', { name: /cancelar partido/i }));

    expect(onCancelMatch).toHaveBeenCalled();
  });
});
