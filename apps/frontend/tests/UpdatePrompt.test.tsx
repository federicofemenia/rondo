import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UpdatePrompt from '../src/UpdatePrompt';

const updateServiceWorker = vi.fn().mockResolvedValue(undefined);
const setNeedRefresh = vi.fn();
let needRefresh = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

describe('UpdatePrompt', () => {
  it('renders nothing when no update is waiting', () => {
    needRefresh = false;
    render(<UpdatePrompt />);

    expect(screen.queryByText(/nueva versión disponible/i)).toBeFalsy();
  });

  it('shows the update notice and calls updateServiceWorker(true) on Actualizar', () => {
    needRefresh = true;
    render(<UpdatePrompt />);

    expect(screen.getByText(/nueva versión disponible/i)).toBeTruthy();
    expect(screen.getByText(/hay una nueva versión de rondo disponible/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /^actualizar$/i }));
    expect(updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('can be dismissed without updating', () => {
    needRefresh = true;
    render(<UpdatePrompt />);

    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));
    expect(setNeedRefresh).toHaveBeenCalledWith(false);
  });
});
