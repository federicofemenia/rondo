import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuthSessionDto, AuthUserDto, LoginInputDto, RegisterInputDto } from '@rondo/contracts';
import { useApi } from './apiClient';

type AuthContextValue = {
  user: AuthUserDto | null;
  authenticated: boolean;
  /** True only until the initial GET /auth/session resolves -- mirrors the old Clerk useAuth()'s `isLoaded`. */
  loading: boolean;
  register: (input: RegisterInputDto) => Promise<{ error: string | null }>;
  login: (input: LoginInputDto) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const api = useApi();
  const [user, setUser] = useState<AuthUserDto | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const response = await api.get<{ data: AuthSessionDto }>('/api/v1/auth/session');
      setUser(response.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void refreshSession();
    // Only ever runs once, on mount -- refreshSession is stable (useApi()'s
    // returned object is a stable singleton, not recreated per render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const register = useCallback(
    async (input: RegisterInputDto) => {
      try {
        const response = await api.post<{ data: AuthSessionDto }>('/api/v1/auth/register', input);
        // The register response already carries the full session (the
        // cookie was set by this same call) -- set state directly from it,
        // no second login/finalize round-trip needed.
        setUser(response.data.user);
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'No pudimos completar el registro.' };
      }
    },
    [api],
  );

  const login = useCallback(
    async (input: LoginInputDto) => {
      try {
        const response = await api.post<{ data: AuthSessionDto }>('/api/v1/auth/login', input);
        setUser(response.data.user);
        return { error: null };
      } catch (error) {
        return { error: error instanceof Error ? error.message : 'No pudimos iniciar sesión.' };
      }
    },
    [api],
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch {
      // Logout must clear local state regardless of whether the backend
      // call itself succeeded -- see AuthProvider's own contract.
    } finally {
      setUser(null);
    }
  }, [api]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, authenticated: user !== null, loading, register, login, logout, refreshSession }),
    [user, loading, register, login, logout, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
