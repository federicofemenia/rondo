import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AppHeader from '../src/AppHeader';

describe('AppHeader', () => {
  it('hides the notification dot when there are no pending actions', () => {
    render(<AppHeader />);

    const badge = screen.getByLabelText('Notificaciones').querySelector('.MuiBadge-badge');
    expect(badge).toBeTruthy();
    expect(badge?.className).toMatch(/MuiBadge-invisible/);
  });

  it('shows a red notification dot when there are pending actions', () => {
    render(<AppHeader pendingActionsCount={3} />);

    const badge = screen.getByLabelText('Notificaciones (3 pendientes)').querySelector('.MuiBadge-badge');
    expect(badge).toBeTruthy();
    expect(badge?.className).not.toMatch(/MuiBadge-invisible/);
    expect(badge?.className).toMatch(/MuiBadge-colorError/);
  });

  it('uses the singular form of the label for exactly one pending action', () => {
    render(<AppHeader pendingActionsCount={1} />);

    expect(screen.getByLabelText('Notificaciones (1 pendiente)')).toBeTruthy();
  });
});
