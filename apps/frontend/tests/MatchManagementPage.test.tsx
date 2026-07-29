import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MatchManagementPage from '../src/MatchManagementPage';

describe('MatchManagementPage', () => {
  it('renders the management actions for a match', () => {
    render(<MatchManagementPage />);

    expect(screen.getByRole('heading', { name: /gestión del partido/i })).toBeTruthy();
    expect(screen.getAllByText(/quitar/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/confirmar partido/i)).toBeTruthy();
    expect(screen.getByText(/finalizar partido/i)).toBeTruthy();
  });

  it('calls the finish handler when the organizer finishes the match', () => {
    const onFinish = vi.fn();
    render(<MatchManagementPage onFinish={onFinish} />);

    fireEvent.click(screen.getByRole('button', { name: /finalizar partido/i }));

    expect(onFinish).toHaveBeenCalled();
  });
});
