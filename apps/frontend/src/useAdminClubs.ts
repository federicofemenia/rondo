import { useCallback, useEffect, useState } from 'react';
import type { AdminClubSummaryDto } from '@rondo/contracts';
import { useApi } from './apiClient';

type UseAdminClubsResult = {
  clubs: AdminClubSummaryDto[];
  loading: boolean;
  error: boolean;
  reload: () => void;
};

/**
 * Mirrors useMyClubs' shape, but against /api/v1/admin/clubs -- the backend
 * itself decides what "administrable" means (every club for a SUPERADMIN,
 * only actively-administered ones for a CLUB_ADMIN, none for a MEMBER), so
 * an empty result here doubles as "this user has no admin access at all"
 * for gating the Administración menu item.
 */
export function useAdminClubs(): UseAdminClubsResult {
  const api = useApi();
  const [clubs, setClubs] = useState<AdminClubSummaryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        const payload = await api.get<{ data: AdminClubSummaryDto[] }>('/api/v1/admin/clubs');
        if (!cancelled) {
          setClubs(payload.data);
          setError(false);
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
  }, [reloadToken]);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  return { clubs, loading, error, reload };
}
