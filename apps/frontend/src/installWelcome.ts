import { useSyncExternalStore } from 'react';
import { dismissInstallPrompt, isInstallPromptDismissed } from './installDismissal';
import { getInstallPromptSnapshot, notifyInstallPromptListeners, subscribeToInstallPrompt } from './installPrompt';
import { isIosDevice, isIosSafariBrowser, isStandaloneDisplayMode } from './pwaDisplayMode';

export const INSTALL_WELCOME_DISMISSAL_KEY = 'rondo-install-welcome-dismissed-at';
/** Shorter than the old generic banners' 7 days: this is a first-visit nudge, not a standing reminder. */
export const INSTALL_WELCOME_DISMISSAL_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function computeInstallWelcomeVisible(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const { installed } = getInstallPromptSnapshot();
  if (installed || isStandaloneDisplayMode()) {
    return false;
  }
  if (isInstallPromptDismissed(INSTALL_WELCOME_DISMISSAL_KEY, INSTALL_WELCOME_DISMISSAL_WINDOW_MS)) {
    return false;
  }
  // iOS devices on a non-Safari browser (Chrome/Firefox-on-iOS) have no
  // install path we can guide them through -- same silent gap the old
  // IosInstallGuide already had, not a new regression.
  if (isIosDevice() && !isIosSafariBrowser()) {
    return false;
  }
  return true;
}

/**
 * Whether the first-authenticated-visit install card/dialog
 * (InstallWelcomeDialog) is currently eligible to show. Exported as its own
 * hook (backed by the same install-prompt store, so it reacts live to
 * beforeinstallprompt/appinstalled) so PushNotificationsBanner can suppress
 * itself while this is true -- the two must never compete for the user's
 * attention at once (installing takes priority over activating push).
 */
export function useInstallWelcomeVisible(): boolean {
  return useSyncExternalStore(subscribeToInstallPrompt, computeInstallWelcomeVisible, computeInstallWelcomeVisible);
}

/** Dismisses the install-welcome card for INSTALL_WELCOME_DISMISSAL_WINDOW_MS and notifies every subscriber (including PushNotificationsBanner) to re-evaluate immediately, without waiting for a remount. */
export function dismissInstallWelcome(): void {
  dismissInstallPrompt(INSTALL_WELCOME_DISMISSAL_KEY);
  notifyInstallPromptListeners();
}
