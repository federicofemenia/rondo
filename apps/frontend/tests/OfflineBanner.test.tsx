import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import OfflineBanner from '../src/OfflineBanner';

function setNavigatorOnLine(value: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value });
}

describe('OfflineBanner', () => {
  const originalOnLine = window.navigator.onLine;

  afterEach(() => {
    setNavigatorOnLine(originalOnLine);
  });

  it('renders nothing while online', () => {
    setNavigatorOnLine(true);
    render(<OfflineBanner />);

    expect(screen.queryByText(/sin conexión/i)).toBeFalsy();
  });

  it('shows "Sin conexión" when the browser starts offline', () => {
    setNavigatorOnLine(false);
    render(<OfflineBanner />);

    expect(screen.getByText(/sin conexión/i)).toBeTruthy();
  });

  it('reacts to the offline/online window events while mounted', () => {
    setNavigatorOnLine(true);
    render(<OfflineBanner />);
    expect(screen.queryByText(/sin conexión/i)).toBeFalsy();

    act(() => {
      setNavigatorOnLine(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByText(/sin conexión/i)).toBeTruthy();

    act(() => {
      setNavigatorOnLine(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByText(/sin conexión/i)).toBeFalsy();
  });
});
