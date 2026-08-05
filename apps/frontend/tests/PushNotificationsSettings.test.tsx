import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PushNotificationsSettings from '../src/PushNotificationsSettings';
import { mockPushState } from './setup';

function fakeSubscription(endpoint: string) {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: 'p256dh-value', auth: 'auth-value' } }),
    unsubscribe: vi.fn(async () => true),
  };
}

function stubBrowser(options: { permission?: NotificationPermission; existingSubscription?: ReturnType<typeof fakeSubscription> | null } = {}) {
  const { permission = 'default', existingSubscription = null } = options;
  let current = existingSubscription;
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => {
      current = fakeSubscription('https://push.example.com/settings-test');
      return current;
    }),
  };
  vi.stubGlobal('Notification', { permission, requestPermission: vi.fn(async () => 'granted' as NotificationPermission) });
  vi.stubGlobal('PushManager', class {});
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager }) } });
}

function stubUnsupported() {
  vi.stubGlobal('Notification', undefined);
  vi.stubGlobal('PushManager', undefined);
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: undefined });
}

describe('PushNotificationsSettings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows "No compatibles" and no action buttons when Web Push is unsupported', () => {
    stubUnsupported();
    render(<PushNotificationsSettings />);

    expect(screen.getByText(/estado: no compatibles/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^activar$/i })).toBeFalsy();
    expect(screen.queryByRole('button', { name: /^desactivar$/i })).toBeFalsy();
  });

  it('shows "Desactivadas" and an Activar button when permission is still default', () => {
    stubBrowser({ permission: 'default' });
    render(<PushNotificationsSettings />);

    expect(screen.getByText(/estado: desactivadas/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^activar$/i })).toBeTruthy();
  });

  it('shows "Bloqueadas" with the site-settings hint, and no Activar button, when permission is denied', () => {
    stubBrowser({ permission: 'denied' });
    render(<PushNotificationsSettings />);

    expect(screen.getByText(/estado: bloqueadas/i)).toBeTruthy();
    expect(screen.getByText(/están bloqueadas en el navegador/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^activar$/i })).toBeFalsy();
  });

  it('shows "Activadas" and a Desactivar button once a local subscription is reconciled', async () => {
    stubBrowser({ permission: 'granted', existingSubscription: fakeSubscription('https://push.example.com/already-on') });
    render(<PushNotificationsSettings />);

    expect(await screen.findByText(/estado: activadas/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^desactivar$/i })).toBeTruthy();
  });

  it('disables "Enviar prueba" until notifications are enabled', () => {
    stubBrowser({ permission: 'default' });
    render(<PushNotificationsSettings />);

    expect(screen.getByRole('button', { name: /enviar prueba/i })).toHaveProperty('disabled', true);
  });

  it('clicking Activar calls enable() and eventually flips the state to Activadas', async () => {
    stubBrowser({ permission: 'default' });
    render(<PushNotificationsSettings />);

    fireEvent.click(screen.getByRole('button', { name: /^activar$/i }));

    expect(await screen.findByText(/estado: activadas/i)).toBeTruthy();
  });

  it('clicking Desactivar calls disable() and flips the state back to Desactivadas', async () => {
    stubBrowser({ permission: 'granted', existingSubscription: fakeSubscription('https://push.example.com/to-disable') });
    render(<PushNotificationsSettings />);
    await screen.findByText(/estado: activadas/i);

    fireEvent.click(screen.getByRole('button', { name: /^desactivar$/i }));

    expect(await screen.findByText(/estado: desactivadas/i)).toBeTruthy();
  });

  it('"Enviar prueba" calls the test endpoint and shows a success message', async () => {
    stubBrowser({ permission: 'granted', existingSubscription: fakeSubscription('https://push.example.com/test-button') });
    render(<PushNotificationsSettings />);
    await screen.findByText(/estado: activadas/i);

    fireEvent.click(screen.getByRole('button', { name: /enviar prueba/i }));

    expect(await screen.findByText(/notificación de prueba enviada/i)).toBeTruthy();
  });

  it('shows an error message when "Enviar prueba" fails', async () => {
    mockPushState.testFailing = true;
    stubBrowser({ permission: 'granted', existingSubscription: fakeSubscription('https://push.example.com/test-button-fail') });
    render(<PushNotificationsSettings />);
    await screen.findByText(/estado: activadas/i);

    fireEvent.click(screen.getByRole('button', { name: /enviar prueba/i }));

    expect(await screen.findByText(/no pudimos enviar la notificación de prueba/i)).toBeTruthy();
  });
});
