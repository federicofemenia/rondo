import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getInstallPromptSnapshot,
  resetInstallPromptStateForDev,
  subscribeToInstallPrompt,
  triggerInstallPrompt,
} from '../src/installPrompt';

function dispatchBeforeInstallPrompt(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  };
  event.prompt = vi.fn().mockResolvedValue(undefined);
  event.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(event);
  return event;
}

describe('installPrompt (module-level singleton)', () => {
  afterEach(() => {
    resetInstallPromptStateForDev();
  });

  it('captures beforeinstallprompt even with zero subscribers -- the listener is registered at module import time, not behind any component mount', () => {
    // No render(), no hook call, no subscriber at all -- yet the module
    // (already imported at the top of this file, like every real app entry
    // point) has been listening since it was first evaluated.
    dispatchBeforeInstallPrompt();

    expect(getInstallPromptSnapshot().deferredEvent).not.toBeNull();
  });

  it('notifies subscribers when the event arrives', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToInstallPrompt(listener);

    dispatchBeforeInstallPrompt();

    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it('triggerInstallPrompt calls prompt(), awaits userChoice, and clears the deferred event', async () => {
    const event = dispatchBeforeInstallPrompt('accepted');

    const outcome = await triggerInstallPrompt();

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('accepted');
    expect(getInstallPromptSnapshot().deferredEvent).toBeNull();
  });

  it('a "dismissed" outcome is reported as such, never reinterpreted as installed', async () => {
    dispatchBeforeInstallPrompt('dismissed');

    const outcome = await triggerInstallPrompt();

    expect(outcome).toBe('dismissed');
    expect(getInstallPromptSnapshot().installed).toBe(false);
  });

  it('returns "unavailable" when there is no captured event to prompt', async () => {
    const outcome = await triggerInstallPrompt();
    expect(outcome).toBe('unavailable');
  });

  it('appinstalled marks the snapshot installed and persists it to localStorage', () => {
    window.dispatchEvent(new Event('appinstalled'));

    expect(getInstallPromptSnapshot().installed).toBe(true);
    expect(localStorage.getItem('rondo-pwa-installed')).toBe('true');
  });

  it('resetInstallPromptStateForDev clears both the in-memory snapshot and the persisted flag', () => {
    window.dispatchEvent(new Event('appinstalled'));
    expect(getInstallPromptSnapshot().installed).toBe(true);

    resetInstallPromptStateForDev();

    expect(getInstallPromptSnapshot().installed).toBe(false);
    expect(localStorage.getItem('rondo-pwa-installed')).toBeNull();
  });
});
