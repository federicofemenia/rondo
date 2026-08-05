import { useSyncExternalStore } from 'react';
import { getInstallPromptSnapshot, subscribeToInstallPrompt, triggerInstallPrompt } from './installPrompt';

type UseInstallPromptResult = {
  /** True once the browser has told us the app is installable (Android Chrome/Edge only -- iOS Safari never fires this). */
  isInstallable: boolean;
  /** True once `appinstalled` fired (this session or a previous one -- see installPrompt.ts). */
  isInstalled: boolean;
  /** Shows the native install prompt; resolves once the user has answered it. */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
};

/**
 * Reads the module-level install-prompt singleton (installPrompt.ts) via
 * `useSyncExternalStore`, so every component using this hook re-renders the
 * instant `beforeinstallprompt`/`appinstalled` fire, no matter which
 * component (if any) was mounted when the browser actually fired the event
 * -- the listener itself lives in installPrompt.ts, registered at import
 * time, not in a `useEffect` here.
 */
export function useInstallPrompt(): UseInstallPromptResult {
  const snapshot = useSyncExternalStore(subscribeToInstallPrompt, getInstallPromptSnapshot, getInstallPromptSnapshot);

  return {
    isInstallable: snapshot.deferredEvent !== null,
    isInstalled: snapshot.installed,
    promptInstall: triggerInstallPrompt,
  };
}
