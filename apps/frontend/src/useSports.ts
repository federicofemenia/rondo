import { useEffect, useState } from 'react';
import type { SportDto } from '@rondo/contracts';
import { apiBaseUrl } from './runtimeConfig';

type UseSportsResult = {
  sports: SportDto[];
  loading: boolean;
  error: boolean;
};

export function useSports(): UseSportsResult {
  const [sports, setSports] = useState<SportDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSports = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/sports`);
        if (!response.ok) {
          throw new Error(`Unexpected status ${response.status}`);
        }
        const payload = (await response.json()) as { data: SportDto[] };
        if (!cancelled) {
          setSports(payload.data);
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

    void loadSports();

    return () => {
      cancelled = true;
    };
  }, []);

  return { sports, loading, error };
}
