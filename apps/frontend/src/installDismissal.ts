const DISMISSAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Whether `storageKey` was dismissed within the last 7 days -- shared by InstallRondoBanner and IosInstallGuide so both "don't nag" the same way. */
export function isInstallPromptDismissed(storageKey: string): boolean {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return false;
  }
  const dismissedAt = Number(raw);
  if (!Number.isFinite(dismissedAt)) {
    return false;
  }
  return Date.now() - dismissedAt < DISMISSAL_WINDOW_MS;
}

export function dismissInstallPrompt(storageKey: string): void {
  localStorage.setItem(storageKey, String(Date.now()));
}
