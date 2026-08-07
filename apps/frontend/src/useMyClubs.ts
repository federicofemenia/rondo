import { useEffect, useState } from 'react';
import type { UserClubDto } from '@rondo/contracts';
import { useApi } from './apiClient';
import { useAuth } from './AuthProvider';

type UseMyClubsResult = {
  clubs: UserClubDto[];
  loading: boolean;
  error: boolean;
};

/**
 * Re-fetches whenever the signed-in identity changes (userId, or
 * isSignedIn flipping) -- App.tsx is never unmounted across
 * logout/login/register, so without this a club list fetched for one
 * account would otherwise keep showing after a different account signs in
 * on the same tab.
 */
export function useMyClubs(): UseMyClubsResult {
  const api = useApi();
  const { user, authenticated: isSignedIn } = useAuth();
  const userId = user?.id;
  const [clubs, setClubs] = useState<UserClubDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!isSignedIn) {
      setClubs([]);
      setError(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    const load = async () => {
      try {
        const payload = await api.get<{ data: UserClubDto[] }>('/api/v1/me/clubs');
        if (!cancelled) {
          setClubs(payload.data);
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isSignedIn]);

  return { clubs, loading, error };
}
