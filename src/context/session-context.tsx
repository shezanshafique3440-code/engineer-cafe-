"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiGet, apiPost } from "@/lib/api-client";
import type { SessionUser } from "@/lib/types";

type SessionValue = {
  user: SessionUser | null;
  loading: boolean;
  isStaff: boolean;
  refresh: () => Promise<SessionUser | null>;
  setUser: (user: SessionUser | null) => void;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: SessionUser | null;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ user: SessionUser | null }>("/api/auth/me");
      setUser(data.user);
      return data.user;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await apiPost("/api/auth/logout").catch(() => undefined);
    setUser(null);
  }, []);

  // Re-sync when the tab regains focus so a session that expired elsewhere
  // doesn't leave a stale "logged in" navbar.
  useEffect(() => {
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      loading,
      isStaff: user?.role === "ADMIN" || user?.role === "STAFF",
      refresh,
      setUser,
      logout,
    }),
    [user, loading, refresh, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>.");
  return ctx;
}
