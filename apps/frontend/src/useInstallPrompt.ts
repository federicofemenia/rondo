import { useEffect, useState } from 'react';

/** Non-standard event Chrome/Edge/Android fire when the app becomes installable; not yet in lib.dom.d.ts. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type UseInstallPromptResult = {
  /** True once the browser has told us the app is installable (Android Chrome/Edge only -- iOS Safari never fires this). */
  isInstallable: boolean;
  /** Shows the native install prompt; resolves once the user has answered it. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
};

/**
 * Wraps the `beforeinstallprompt` event: Chromium browsers fire it once,
 * ahead of time, and expect the page to have stashed it if it wants to
 * trigger the native prompt later (from our own banner instead of a browser
 * popup). Consumed by InstallRondoBanner.
 */
export function useInstallPrompt(): UseInstallPromptResult {
  const [deferredEvent, setDeferredEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredEvent(event as BeforeInstallPromptEvent);
    };
    // Fired once the app is actually installed, whether via our banner or
    // the browser's own menu -- either way, there's nothing left to prompt.
    const handleAppInstalled = () => setDeferredEvent(null);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredEvent) {
      return 'unavailable';
    }
    await deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    setDeferredEvent(null);
    return outcome;
  };

  return { isInstallable: deferredEvent !== null, promptInstall };
}
