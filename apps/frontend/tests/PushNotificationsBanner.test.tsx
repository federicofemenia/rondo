import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PushNotificationsBanner from '../src/PushNotificationsBanner';
import { INSTALL_WELCOME_DISMISSAL_KEY } from '../src/installWelcome';

const DISMISSAL_STORAGE_KEY = 'rondo-push-banner-dismissed-at';

const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';

function stubNavigator(overrides: { userAgent?: string; standalone?: boolean; serviceWorker?: unknown } = {}) {
  vi.stubGlobal('navigator', {
    ...navigator,
    userAgent: overrides.userAgent ?? DESKTOP_UA,
    platform: navigator.platform,
    maxTouchPoints: 0,
    standalone: overrides.standalone,
    serviceWorker: overrides.serviceWorker,
  });
}

function stubSupportedBrowser(permission: NotificationPermission) {
  const pushManager = {
    getSubscription: vi.fn(async () => null),
    subscribe: vi.fn(async () => ({
      endpoint: 'https://push.example.com/banner-test',
      toJSON: () => ({ endpoint: 'https://push.example.com/banner-test', keys: { p256dh: 'p256dh', auth: 'auth' } }),
      unsubscribe: vi.fn(async () => true),
    })),
  };
  stubNavigator({ userAgent: DESKTOP_UA, serviceWorker: { ready: Promise.resolve({ pushManager }) } });
  vi.stubGlobal('PushManager', class {});
  vi.stubGlobal('Notification', { permission, requestPermission: vi.fn(async () => 'granted' as NotificationPermission) });
}

describe('PushNotificationsBanner', () => {
  // Installing takes priority over activating push (see docs/PWA.md): every
  // test below is about the push banner's OWN behavior, not the sequencing
  // with InstallWelcomeDialog, so it's marked dismissed by default here --
  // the dedicated sequencing test further down clears it back out.
  beforeEach(() => {
    localStorage.setItem(INSTALL_WELCOME_DISMISSAL_KEY, String(Date.now()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('renders nothing when Web Push is not supported and the device is not iOS', () => {
    stubNavigator({ userAgent: DESKTOP_UA });
    render(<PushNotificationsBanner />);

    expect(screen.queryByText(/activá las notificaciones/i)).toBeFalsy();
  });

  it('shows the activation banner when supported and permission is still "default"', () => {
    stubSupportedBrowser('default');
    render(<PushNotificationsBanner />);

    expect(screen.getByText(/activá las notificaciones/i)).toBeTruthy();
    expect(screen.getByText(/recibí avisos cuando te inviten a un partido/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^activar$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /ahora no/i })).toBeTruthy();
  });

  it('does not show once permission is already granted', () => {
    stubSupportedBrowser('granted');
    render(<PushNotificationsBanner />);

    expect(screen.queryByText(/activá las notificaciones/i)).toBeFalsy();
  });

  it('does not show once permission is denied', () => {
    stubSupportedBrowser('denied');
    render(<PushNotificationsBanner />);

    expect(screen.queryByText(/activá las notificaciones/i)).toBeFalsy();
  });

  it('shows the iPhone install-first message when on iOS and not installed, even if Web Push APIs are unsupported', () => {
    stubNavigator({ userAgent: IPHONE_UA, standalone: false });
    render(<PushNotificationsBanner />);

    expect(screen.getByText(/activá las notificaciones/i)).toBeTruthy();
    expect(screen.getByText(/para recibir notificaciones en iphone, primero agregá rondo a tu pantalla de inicio/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^activar$/i })).toBeFalsy();
    expect(screen.queryByRole('button', { name: /ahora no/i })).toBeFalsy();
  });

  it('does not show the iPhone install message once Rondo is already installed (standalone)', () => {
    stubNavigator({ userAgent: IPHONE_UA, standalone: true });
    render(<PushNotificationsBanner />);

    expect(screen.queryByText(/para recibir notificaciones en iphone/i)).toBeFalsy();
  });

  it('"Ahora no" hides the banner and persists the dismissal for this device', () => {
    stubSupportedBrowser('default');
    render(<PushNotificationsBanner />);

    fireEvent.click(screen.getByRole('button', { name: /ahora no/i }));

    expect(screen.queryByText(/activá las notificaciones/i)).toBeFalsy();
    expect(localStorage.getItem(DISMISSAL_STORAGE_KEY)).toBeTruthy();
  });

  it('closing with the X icon also dismisses it', () => {
    stubSupportedBrowser('default');
    render(<PushNotificationsBanner />);

    fireEvent.click(screen.getByRole('button', { name: /cerrar/i }));

    expect(screen.queryByText(/activá las notificaciones/i)).toBeFalsy();
    expect(localStorage.getItem(DISMISSAL_STORAGE_KEY)).toBeTruthy();
  });

  it('does not reappear shortly after being dismissed', () => {
    localStorage.setItem(DISMISSAL_STORAGE_KEY, String(Date.now()));
    stubSupportedBrowser('default');
    render(<PushNotificationsBanner />);

    expect(screen.queryByText(/activá las notificaciones/i)).toBeFalsy();
  });

  it('"Activar" triggers the browser permission request, and the banner hides once permission is granted', async () => {
    stubSupportedBrowser('default');
    const { requestPermission } = Notification as unknown as { requestPermission: ReturnType<typeof vi.fn> };
    render(<PushNotificationsBanner />);

    fireEvent.click(screen.getByRole('button', { name: /^activar$/i }));

    expect(requestPermission).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(screen.queryByText(/activá las notificaciones/i)).toBeFalsy());
  });

  it('stays hidden while the install-welcome card is still eligible to show (installing takes priority)', () => {
    localStorage.removeItem(INSTALL_WELCOME_DISMISSAL_KEY);
    stubSupportedBrowser('default');
    render(<PushNotificationsBanner />);

    expect(screen.queryByText(/activá las notificaciones/i)).toBeFalsy();
  });
});
