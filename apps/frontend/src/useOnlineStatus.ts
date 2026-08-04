import { useEffect, useState } from 'react';

/**
 * Tracks the browser's own connectivity signal (`navigator.onLine` plus the
 * `online`/`offline` window events) -- deliberately separate from
 * `bootPhase` in App.tsx, which tracks whether the (possibly sleeping)
 * Render backend is reachable. A device can be online while the backend is
 * still waking up, or offline while the backend would otherwise be fine;
 * conflating the two would show the wrong message for either case.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
