import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dismissInstallPrompt, isInstallPromptDismissed } from '../src/installDismissal';

const KEY = 'test-install-dismissed-at';

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('isInstallPromptDismissed / dismissInstallPrompt', () => {
  it('is not dismissed when never dismissed before', () => {
    expect(isInstallPromptDismissed(KEY)).toBe(false);
  });

  it('is dismissed right after dismissing', () => {
    dismissInstallPrompt(KEY);
    expect(isInstallPromptDismissed(KEY)).toBe(true);
  });

  it('stops being dismissed once 7 days have passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    dismissInstallPrompt(KEY);
    expect(isInstallPromptDismissed(KEY)).toBe(true);

    vi.setSystemTime(new Date('2026-01-08T00:00:01Z'));
    expect(isInstallPromptDismissed(KEY)).toBe(false);
  });

  it('treats corrupted storage as not dismissed', () => {
    localStorage.setItem(KEY, 'not-a-number');
    expect(isInstallPromptDismissed(KEY)).toBe(false);
  });
});
