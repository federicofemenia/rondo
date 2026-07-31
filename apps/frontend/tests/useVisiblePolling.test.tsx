import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisiblePolling } from '../src/useVisiblePolling';

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
}

type TestHarnessProps = {
  callback: () => void | Promise<void>;
  intervalMs?: number;
  enabled?: boolean;
  runImmediately?: boolean;
};

function TestHarness({ callback, intervalMs = 20_000, enabled = true, runImmediately = true }: TestHarnessProps) {
  useVisiblePolling({ callback, intervalMs, enabled, runImmediately });
  return null;
}

describe('useVisiblePolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    setVisibility('visible');
  });

  it('runs the callback immediately on mount when visible', () => {
    const callback = vi.fn();
    render(<TestHarness callback={callback} />);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not run immediately when runImmediately is false', () => {
    const callback = vi.fn();
    render(<TestHarness callback={callback} runImmediately={false} />);

    expect(callback).not.toHaveBeenCalled();
  });

  it('refreshes every 20 seconds while visible', async () => {
    const callback = vi.fn();
    render(<TestHarness callback={callback} />);
    expect(callback).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(callback).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('does not refresh while hidden', async () => {
    setVisibility('hidden');
    const callback = vi.fn();
    render(<TestHarness callback={callback} />);
    expect(callback).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('clears the interval once the tab becomes hidden', async () => {
    const callback = vi.fn();
    render(<TestHarness callback={callback} />);
    expect(callback).toHaveBeenCalledTimes(1);

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    await vi.advanceTimersByTimeAsync(60_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('refreshes immediately when the tab becomes visible again', () => {
    setVisibility('hidden');
    const callback = vi.fn();
    render(<TestHarness callback={callback} />);
    expect(callback).not.toHaveBeenCalled();

    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('refreshes on window focus while visible', async () => {
    const callback = vi.fn();
    render(<TestHarness callback={callback} />);
    expect(callback).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);

    window.dispatchEvent(new Event('focus'));
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('refreshes on the online event while visible', async () => {
    const callback = vi.fn();
    render(<TestHarness callback={callback} />);
    expect(callback).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);

    window.dispatchEvent(new Event('online'));
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('does not create duplicate intervals when visibility toggles rapidly', async () => {
    const callback = vi.fn();
    render(<TestHarness callback={callback} />);
    expect(callback).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 5; i += 1) {
      setVisibility('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      setVisibility('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    }

    callback.mockClear();
    await vi.advanceTimersByTimeAsync(20_000);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not run two callbacks simultaneously', async () => {
    let resolveFirst: (() => void) | undefined;
    const callback = vi.fn(() => new Promise<void>((resolve) => { resolveFirst = resolve; }));

    render(<TestHarness callback={callback} />);
    expect(callback).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(callback).toHaveBeenCalledTimes(1);

    resolveFirst?.();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(20_000);

    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('releases the in-flight guard even if the callback rejects', async () => {
    const callback = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    render(<TestHarness callback={callback} />);
    expect(callback).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('cleans up timers and listeners on unmount', async () => {
    const callback = vi.fn();
    const { unmount } = render(<TestHarness callback={callback} />);
    expect(callback).toHaveBeenCalledTimes(1);

    unmount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(callback).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event('focus'));
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', async () => {
    const callback = vi.fn();
    render(<TestHarness callback={callback} enabled={false} />);
    expect(callback).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(60_000);
    window.dispatchEvent(new Event('focus'));
    expect(callback).not.toHaveBeenCalled();
  });
});
