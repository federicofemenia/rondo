import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OfflineScreen from '../src/OfflineScreen';

describe('OfflineScreen', () => {
  it('shows the offline message and calls onRetry when tapped', () => {
    const onRetry = vi.fn();
    render(<OfflineScreen onRetry={onRetry} />);

    expect(screen.getByText(/sin conexión/i)).toBeTruthy();
    expect(screen.getByText(/rondo necesita conexión para actualizar partidos, invitaciones y mensajes/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /reintentar/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
