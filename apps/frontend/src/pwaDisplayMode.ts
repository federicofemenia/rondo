/** True once the app is already running installed (standalone window, no browser chrome). */
export function isStandaloneDisplayMode(): boolean {
  const isStandaloneMedia = typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches;
  // iOS Safari never matches the standalone media query; it exposes this
  // non-standard boolean on navigator instead.
  const isIosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return isStandaloneMedia || isIosStandalone;
}

/** iPhone/iPad, feature-detected via touch support rather than parsing the full UA string. */
export function isIosDevice(): boolean {
  const platformLooksLikeIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  // iPadOS 13+ reports as "MacIntel" but (unlike a real Mac) supports touch.
  const isIpadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return platformLooksLikeIos || isIpadOs;
}

/** Safari specifically (not Chrome/Firefox/etc. on iOS, which are all still WebKit but never expose beforeinstallprompt either way -- this only gates which install guide copy to show). */
export function isIosSafariBrowser(): boolean {
  const ua = navigator.userAgent;
  const isSafari = /safari/i.test(ua);
  const isOtherIosBrowser = /crios|fxios|edgios|opios/i.test(ua);
  return isSafari && !isOtherIosBrowser;
}
