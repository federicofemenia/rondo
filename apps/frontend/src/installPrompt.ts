/** Non-standard event Chrome/Edge/Android fire when the app becomes installable; not yet in lib.dom.d.ts. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type InstallPromptSnapshot = {
  deferredEvent: BeforeInstallPromptEvent | null;
  /** Persisted (see PWA_INSTALLED_STORAGE_KEY): survives reloads and re-visits in a plain (non-standalone) tab after installing. */
  installed: boolean;
};

const PWA_INSTALLED_STORAGE_KEY = 'rondo-pwa-installed';

function readInstalledFlag(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(PWA_INSTALLED_STORAGE_KEY) === 'true';
}

let snapshot: InstallPromptSnapshot = { deferredEvent: null, installed: readInstalledFlag() };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

function handleBeforeInstallPrompt(event: Event): void {
  event.preventDefault();
  snapshot = { ...snapshot, deferredEvent: event as BeforeInstallPromptEvent };
  emit();
}

function handleAppInstalled(): void {
  // Fired regardless of which UI (our dialog or the browser's own menu)
  // triggered the install. Persisted so a *future* visit in a plain
  // (non-standalone) tab -- e.g. a shared link opened in regular Chrome --
  // still knows the app is already installed, instead of nagging again.
  localStorage.setItem(PWA_INSTALLED_STORAGE_KEY, 'true');
  snapshot = { deferredEvent: null, installed: true };
  emit();
}

/**
 * Registered at module evaluation time -- as early as this file is first
 * imported, not gated behind any component mounting or any React effect
 * running -- so `beforeinstallprompt` is never missed regardless of which
 * component (if any) happens to be mounted when the browser fires it. This
 * is the single, module-level owner of both listeners: nothing else in the
 * app should call `addEventListener('beforeinstallprompt', ...)` directly.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  window.addEventListener('appinstalled', handleAppInstalled);
}

export function getInstallPromptSnapshot(): InstallPromptSnapshot {
  return snapshot;
}

export function subscribeToInstallPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Lets a component (e.g. after dismissing a install-prompt card) force every subscriber to re-evaluate, without the underlying event/installed state having changed. */
export function notifyInstallPromptListeners(): void {
  emit();
}

export async function triggerInstallPrompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const event = snapshot.deferredEvent;
  if (!event) {
    return 'unavailable';
  }
  await event.prompt();
  const { outcome } = await event.userChoice;
  snapshot = { ...snapshot, deferredEvent: null };
  emit();
  return outcome;
}

/**
 * Clears the in-memory (deferred event, installed) and persisted (installed
 * flag) state without a page reload. Two legitimate callers: a developer
 * poking at this from the console while iterating locally (see
 * docs/PWA.md), and every install-prompt test's `afterEach` -- the module
 * is only evaluated once per test file, so without this, state captured in
 * one test would otherwise leak into the next.
 */
export function resetInstallPromptStateForDev(): void {
  localStorage.removeItem(PWA_INSTALLED_STORAGE_KEY);
  snapshot = { deferredEvent: null, installed: false };
  emit();
}
