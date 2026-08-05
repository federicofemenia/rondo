const DEFAULT_DISMISSAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Whether `storageKey` was dismissed within `windowMs` (default 7 days) -- shared by every dismissible PWA/push nudge so they all "don't nag" consistently, each with its own key and (optionally) its own window. */
export function isInstallPromptDismissed(storageKey: string, windowMs: number = DEFAULT_DISMISSAL_WINDOW_MS): boolean {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return false;
  }
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) {
    return false;
  }
  return Date.now() - dismissedAt < windowMs;
}

export function dismissInstallPrompt(storageKey: string): void {
  localStorage.setItem(storageKey, String(Date.now()));
}
