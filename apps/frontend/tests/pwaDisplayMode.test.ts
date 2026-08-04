import { afterEach, describe, expect, it, vi } from 'vitest';
import { isIosDevice, isIosSafariBrowser, isStandaloneDisplayMode } from '../src/pwaDisplayMode';

function setUserAgent(ua: string) {
  vi.stubGlobal('navigator', { ...navigator, userAgent: ua, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isStandaloneDisplayMode', () => {
  it('is true when the display-mode media query matches', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(display-mode: standalone)' }) as MediaQueryList);

    expect(isStandaloneDisplayMode()).toBe(true);
  });

  it('is true on iOS via navigator.standalone even without the media query matching', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }) as MediaQueryList);
    vi.stubGlobal('navigator', { ...navigator, standalone: true });

    expect(isStandaloneDisplayMode()).toBe(true);
  });

  it('is false in a normal browser tab', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }) as MediaQueryList);

    expect(isStandaloneDisplayMode()).toBe(false);
  });
});

describe('isIosDevice', () => {
  it('detects an iPhone user agent', () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15');
    expect(isIosDevice()).toBe(true);
  });

  it('detects iPadOS reporting as MacIntel with touch support', () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6)', platform: 'MacIntel', maxTouchPoints: 5 });
    expect(isIosDevice()).toBe(true);
  });

  it('is false on a real desktop Mac (no touch points)', () => {
    vi.stubGlobal('navigator', { ...navigator, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6)', platform: 'MacIntel', maxTouchPoints: 0 });
    expect(isIosDevice()).toBe(false);
  });

  it('is false on Android', () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36');
    expect(isIosDevice()).toBe(false);
  });
});

describe('isIosSafariBrowser', () => {
  it('is true for real iOS Safari', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    );
    expect(isIosSafariBrowser()).toBe(true);
  });

  it('is false for Chrome on iOS (CriOS), which also can\'t install via this guide', () => {
    setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
    );
    expect(isIosSafariBrowser()).toBe(false);
  });
});
