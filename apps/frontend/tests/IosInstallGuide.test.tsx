import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IosInstallGuide from '../src/IosInstallGuide';

const DISMISSAL_STORAGE_KEY = 'rondo-ios-install-guide-dismissed-at';
const IOS_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

function stubIosSafari({ standalone = false }: { standalone?: boolean } = {}) {
  vi.stubGlobal('navigator', { ...navigator, userAgent: IOS_SAFARI_UA, standalone });
  vi.stubGlobal('matchMedia', () => ({ matches: false }) as MediaQueryList);
}

describe('IosInstallGuide', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the 3-step guide on iOS Safari when not installed', () => {
    stubIosSafari();
    render(<IosInstallGuide />);

    expect(screen.getByText(/instalá rondo/i)).toBeTruthy();
    expect(screen.getByText(/tocá compartir/i)).toBeTruthy();
    expect(screen.getByText(/agregar a pantalla de inicio/i)).toBeTruthy();
    expect(screen.getByText(/abrí rondo desde el nuevo icono/i)).toBeTruthy();
  });

  it('does not show on a non-iOS browser', () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' });
    vi.stubGlobal('matchMedia', () => ({ matches: false }) as MediaQueryList);
    render(<IosInstallGuide />);

    expect(screen.queryByText(/instalá rondo/i)).toBeFalsy();
  });

  it('does not show once the app is already installed on iOS', () => {
    stubIosSafari({ standalone: true });
    render(<IosInstallGuide />);

    expect(screen.queryByText(/instalá rondo/i)).toBeFalsy();
  });

  it('can be closed, and stays hidden after closing', () => {
    stubIosSafari();
    render(<IosInstallGuide />);

    fireEvent.click(screen.getByRole('button', { name: /entendido/i }));

    expect(screen.queryByText(/instalá rondo/i)).toBeFalsy();
    expect(localStorage.getItem(DISMISSAL_STORAGE_KEY)).toBeTruthy();
  });
});
