"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiGet, apiPost, apiDelete, ApiError } from "@/lib/api-client";
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
  const [user, setUserState] = useState<SessionUser | null>(initialUser);
  const [loading, setLoading] = useState(false);
  const knownUser = useRef(initialUser);
  const revision = useRef(0);
  const setUser = useCallback((value: SessionUser | null) => {
    revision.current++;
    knownUser.current = value;
    setUserState(value);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    // A connection failure is not an authentication rejection. Keep the last
    // known identity for local bills; every server API still revalidates access.
    if (!navigator.onLine) return knownUser.current;
    const request = ++revision.current;
    setLoading(true);
    try {
      const data = await apiGet<{ user: SessionUser | null }>("/api/auth/me");
      if (request !== revision.current) return knownUser.current;
      setUser(data.user);
      return data.user;
    } catch (error) {
      if (request !== revision.current) return knownUser.current;
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403)
      ) {
        setUser(null);
        return null;
      }
      return knownUser.current;
    } finally {
      if (request === revision.current) setLoading(false);
    }
  }, [setUser]);

  const logout = useCallback(async () => {
    if ("serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = await reg?.pushManager?.getSubscription();
        if (sub) {
          await apiDelete("/api/admin/push", { endpoint: sub.endpoint });
          await sub.unsubscribe();
        }
      } catch {
        /* Logging out must remain available. */
      }
    }
    await apiPost("/api/auth/logout").catch(() => undefined);
    await import("@/lib/offline-counter")
      .then((m) => m.counterStore())
      .then((store) => store.clearSnapshot())
      .catch(() => undefined);
    setUser(null);
  }, [setUser]);

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
    [user, loading, refresh, setUser, logout],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx)
    throw new Error("useSession must be used inside <SessionProvider>.");
  return ctx;
}
