import { useEffect, useState } from 'react';
import type { UserClubDto } from '@rondo/contracts';
import { useApi } from './apiClient';

type UseMyClubsResult = {
  clubs: UserClubDto[];
  loading: boolean;
  error: boolean;
};

export function useMyClubs(): UseMyClubsResult {
  const api = useApi();
  const [clubs, setClubs] = useState<UserClubDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

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
  }, []);

  return { clubs, loading, error };
}
