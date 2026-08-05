import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InstallWelcomeDialog from '../src/InstallWelcomeDialog';
import { resetInstallPromptStateForDev } from '../src/installPrompt';
import { INSTALL_WELCOME_DISMISSAL_KEY } from '../src/installWelcome';

const IOS_SAFARI_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15';

function stubIosSafari({ standalone = false }: { standalone?: boolean } = {}) {
  vi.stubGlobal('navigator', { ...navigator, userAgent: IOS_SAFARI_UA, standalone });
  vi.stubGlobal('matchMedia', () => ({ matches: false }) as MediaQueryList);
}

function stubDesktop() {
  vi.stubGlobal('navigator', { ...navigator, userAgent: DESKTOP_UA, standalone: undefined });
  vi.stubGlobal('matchMedia', () => ({ matches: false }) as MediaQueryList);
}

function fireBeforeInstallPrompt(promptImpl: () => Promise<void>, userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>) {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = promptImpl;
  event.userChoice = userChoice;
  act(() => {
    window.dispatchEvent(event);
  });
}

describe('InstallWelcomeDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    stubDesktop();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    resetInstallPromptStateForDev();
  });

  it('shows a generic explanation on first visit, before beforeinstallprompt has fired', () => {
    render(<InstallWelcomeDialog />);

    expect(screen.getByText(/bienvenido a rondo/i)).toBeTruthy();
    expect(screen.getByText(/todavía no habilitó la instalación directa/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^instalar ahora$/i })).toBeFalsy();
  });

  it('shows the Android/Chromium install content once beforeinstallprompt is captured, and "Instalar ahora" calls prompt()', async () => {
    render(<InstallWelcomeDialog />);
    const promptImpl = vi.fn().mockResolvedValue(undefined);
    fireBeforeInstallPrompt(promptImpl, Promise.resolve({ outcome: 'accepted' }));

    expect(await screen.findByRole('button', { name: /^instalar ahora$/i })).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^instalar ahora$/i }));
    });

    expect(promptImpl).toHaveBeenCalledTimes(1);
  });

  it('a "dismissed" outcome hides the card without claiming a false success', async () => {
    render(<InstallWelcomeDialog />);
    fireBeforeInstallPrompt(vi.fn(), Promise.resolve({ outcome: 'dismissed' }));
    await screen.findByRole('button', { name: /^instalar ahora$/i });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^instalar ahora$/i }));
    });

    expect(screen.queryByText(/bienvenido a rondo/i)).toBeFalsy();
    expect(screen.queryByText(/instalada/i)).toBeFalsy();
  });

  it('"Más tarde" dismisses the card and persists the dismissal', () => {
    render(<InstallWelcomeDialog />);

    fireEvent.click(screen.getByRole('button', { name: /más tarde/i }));

    expect(screen.queryByText(/bienvenido a rondo/i)).toBeFalsy();
    expect(localStorage.getItem(INSTALL_WELCOME_DISMISSAL_KEY)).toBeTruthy();
  });

  it('does not reappear shortly after being dismissed, but does after 3 days', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
      localStorage.setItem(INSTALL_WELCOME_DISMISSAL_KEY, String(Date.now()));

      const { unmount } = render(<InstallWelcomeDialog />);
      expect(screen.queryByText(/bienvenido a rondo/i)).toBeFalsy();
      unmount();

      vi.setSystemTime(new Date('2026-01-04T00:00:01Z'));
      render(<InstallWelcomeDialog />);
      expect(screen.getByText(/bienvenido a rondo/i)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the iOS manual install steps on iOS Safari', () => {
    stubIosSafari();
    render(<InstallWelcomeDialog />);

    expect(screen.getByText(/instalá rondo en tu iphone/i)).toBeTruthy();
    expect(screen.getByText(/tocá el botón compartir/i)).toBeTruthy();
    expect(screen.getByText(/agregar a pantalla de inicio/i)).toBeTruthy();
    expect(screen.getByText(/desde la app instalada vas a poder activar las notificaciones/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^entendido$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /recordarme más tarde/i })).toBeTruthy();
  });

  it('"Entendido" on iOS dismisses the card', () => {
    stubIosSafari();
    render(<InstallWelcomeDialog />);

    fireEvent.click(screen.getByRole('button', { name: /^entendido$/i }));

    expect(screen.queryByText(/instalá rondo en tu iphone/i)).toBeFalsy();
  });

  it('does not show once already running standalone (installed)', () => {
    stubIosSafari({ standalone: true });
    render(<InstallWelcomeDialog />);

    expect(screen.queryByText(/bienvenido a rondo/i)).toBeFalsy();
  });

  it('hides immediately once appinstalled fires, without needing a remount', async () => {
    render(<InstallWelcomeDialog />);
    fireBeforeInstallPrompt(vi.fn(), Promise.resolve({ outcome: 'accepted' }));
    await screen.findByText(/bienvenido a rondo/i);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });

    expect(screen.queryByText(/bienvenido a rondo/i)).toBeFalsy();
  });

  it('the captured beforeinstallprompt event survives even if it fired before this component ever mounted', async () => {
    const promptImpl = vi.fn().mockResolvedValue(undefined);
    fireBeforeInstallPrompt(promptImpl, Promise.resolve({ outcome: 'accepted' }));

    render(<InstallWelcomeDialog />);

    expect(await screen.findByRole('button', { name: /^instalar ahora$/i })).toBeTruthy();
  });
});
