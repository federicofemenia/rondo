import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MatchManagementPage from '../src/MatchManagementPage';

describe('MatchManagementPage', () => {
  it('shows the cancelar action and points the organizer to the Jugadores tab for roster management', () => {
    render(<MatchManagementPage />);

    expect(screen.getByRole('heading', { name: /gestión del partido/i })).toBeTruthy();
    expect(screen.getByText(/pestaña jugadores/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /cancelar partido/i })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /quitar/i })).toBeFalsy();
  });

  it('calls onCancelMatch when cancelar partido is clicked', () => {
    const onCancelMatch = vi.fn();
    render(<MatchManagementPage onCancelMatch={onCancelMatch} />);

    fireEvent.click(screen.getByRole('button', { name: /cancelar partido/i }));

    expect(onCancelMatch).toHaveBeenCalled();
  });
});
