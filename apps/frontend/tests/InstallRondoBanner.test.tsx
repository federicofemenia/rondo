import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import InstallRondoBanner from '../src/InstallRondoBanner';

const DISMISSAL_STORAGE_KEY = 'rondo-install-banner-dismissed-at';

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

describe('InstallRondoBanner', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({ matches: false }) as MediaQueryList);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('renders nothing until beforeinstallprompt fires', () => {
    render(<InstallRondoBanner />);
    expect(screen.queryByText(/instalá rondo en tu celular/i)).toBeFalsy();
  });

  it('shows the banner once beforeinstallprompt fires, and Instalar calls prompt()', async () => {
    render(<InstallRondoBanner />);
    const promptImpl = vi.fn().mockResolvedValue(undefined);
    fireBeforeInstallPrompt(promptImpl, Promise.resolve({ outcome: 'accepted' }));

    expect(await screen.findByText(/instalá rondo en tu celular/i)).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^instalar$/i }));
    });

    expect(promptImpl).toHaveBeenCalledTimes(1);
  });

  it('does not show up when the app is already running standalone', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(display-mode: standalone)' }) as MediaQueryList);
    render(<InstallRondoBanner />);
    fireBeforeInstallPrompt(vi.fn(), Promise.resolve({ outcome: 'accepted' }));

    expect(screen.queryByText(/instalá rondo en tu celular/i)).toBeFalsy();
  });

  it('"Ahora no" hides the banner and persists the dismissal', async () => {
    render(<InstallRondoBanner />);
    fireBeforeInstallPrompt(vi.fn(), Promise.resolve({ outcome: 'accepted' }));
    await screen.findByText(/instalá rondo en tu celular/i);

    fireEvent.click(screen.getByRole('button', { name: /ahora no/i }));

    expect(screen.queryByText(/instalá rondo en tu celular/i)).toBeFalsy();
    expect(localStorage.getItem(DISMISSAL_STORAGE_KEY)).toBeTruthy();
  });

  it('does not show again shortly after being dismissed, but does after 7 days', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    localStorage.setItem(DISMISSAL_STORAGE_KEY, String(Date.now()));

    render(<InstallRondoBanner />);
    fireBeforeInstallPrompt(vi.fn(), Promise.resolve({ outcome: 'accepted' }));
    expect(screen.queryByText(/instalá rondo en tu celular/i)).toBeFalsy();

    vi.setSystemTime(new Date('2026-01-08T00:00:01Z'));
    render(<InstallRondoBanner />);
    fireBeforeInstallPrompt(vi.fn(), Promise.resolve({ outcome: 'accepted' }));
    expect(screen.getByText(/instalá rondo en tu celular/i)).toBeTruthy();
  });
});
