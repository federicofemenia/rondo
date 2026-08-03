import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AppHeader from '../src/AppHeader';
import type { PendingAction } from '../src/types';

function buildPendingActions(count: number): PendingAction[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `action-${index}`,
    label: `Acción pendiente ${index}`,
    onClick: vi.fn(),
  }));
}

describe('AppHeader', () => {
  it('hides the notification dot when there are no pending actions', () => {
    render(<AppHeader />);

    const badge = screen.getByLabelText('Notificaciones').querySelector('.MuiBadge-badge');
    expect(badge).toBeTruthy();
    expect(badge?.className).toMatch(/MuiBadge-invisible/);
  });

  it('shows a red notification dot when there are pending actions', () => {
    render(<AppHeader pendingActions={buildPendingActions(3)} />);

    const badge = screen.getByLabelText('Notificaciones (3 pendientes)').querySelector('.MuiBadge-badge');
    expect(badge).toBeTruthy();
    expect(badge?.className).not.toMatch(/MuiBadge-invisible/);
    expect(badge?.className).toMatch(/MuiBadge-colorError/);
  });

  it('uses the singular form of the label for exactly one pending action', () => {
    render(<AppHeader pendingActions={buildPendingActions(1)} />);

    expect(screen.getByLabelText('Notificaciones (1 pendiente)')).toBeTruthy();
  });

  it('shows the pending actions in a dropdown when the bell is clicked, and closes it on selection', async () => {
    const actions = buildPendingActions(2);
    render(<AppHeader pendingActions={actions} />);

    expect(screen.queryByText('Acción pendiente 0')).toBeFalsy();

    fireEvent.click(screen.getByLabelText('Notificaciones (2 pendientes)'));

    expect(screen.getByText('Acción pendiente 0')).toBeTruthy();
    expect(screen.getByText('Acción pendiente 1')).toBeTruthy();

    fireEvent.click(screen.getByText('Acción pendiente 0'));

    expect(actions[0]!.onClick).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Acción pendiente 1')).toBeFalsy());
  });

  it('shows an empty state in the dropdown when there are no pending actions', () => {
    render(<AppHeader />);

    fireEvent.click(screen.getByLabelText('Notificaciones'));

    expect(screen.getByText(/no tenés acciones pendientes/i)).toBeTruthy();
  });
});
