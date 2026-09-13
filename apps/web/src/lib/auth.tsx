'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getProfile, logoutSession, UserProfile } from '@/lib/api';

interface AuthContextValue {
  profile: UserProfile | null;
  loading: boolean;
  token: string | null;
  hasPermission: (p: string | string[]) => boolean;
  hasAnyPermission: (ps: string[]) => boolean;
  refresh: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function clearLegacyTokenStorage() {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    clearLegacyTokenStorage();
    const res = await getProfile();
    if (res.success && res.data) {
      setProfile(res.data);
      setToken('session');
    } else {
      setProfile(null);
      setToken(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const hasPermission = useCallback(
    (p: string | string[]) => {
      if (!profile) return false;
      if (profile.roles.includes('super_admin')) return true;
      const list = Array.isArray(p) ? p : [p];
      return list.every((x) => profile.permissions.includes(x));
    },
    [profile],
  );

  const hasAnyPermission = useCallback(
    (ps: string[]) => {
      if (!profile) return false;
      if (profile.roles.includes('super_admin')) return true;
      return ps.some((x) => profile.permissions.includes(x));
    },
    [profile],
  );

  const logout = useCallback(() => {
    void logoutSession().finally(() => {
      clearLegacyTokenStorage();
      setProfile(null);
      setToken(null);
      window.location.assign('/login');
    });
  }, []);

  const value = useMemo(
    () => ({ profile, loading, token, hasPermission, hasAnyPermission, refresh, logout }),
    [profile, loading, token, hasPermission, hasAnyPermission, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
