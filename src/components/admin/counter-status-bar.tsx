"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Wallet,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import { useSession } from "@/context/session-context";
import { canBusiness } from "@/lib/business-access";
import { readCounterDevice, type CounterSnapshot } from "@/lib/offline-counter";
import { cn } from "@/lib/utils";
type ServerState = {
  actorId: string;
  enabled: boolean;
  shift: { id: string; drawer: { name: string } } | null;
};
type State = {
  ownerId: string;
  connection: "checking" | "online" | "offline" | "unavailable" | "auth";
  current: ServerState | null;
  cached: CounterSnapshot | null;
  pending: number | null;
  review: number | null;
  storageError: boolean;
  recoverOnline: boolean;
};
const initial = (ownerId: string): State => ({
  ownerId,
  connection: "checking",
  current: null,
  cached: null,
  pending: null,
  review: null,
  storageError: false,
  recoverOnline: false,
});

export function CounterStatusBar() {
  const { user } = useSession();
  const ownerId = user?.id ?? "";
  const [state, setState] = useState<State>(() => initial(ownerId));
  useEffect(() => {
    if (!ownerId) return;
    let disposed = false,
      reading = false,
      polling = false,
      readAgain = false;
    let active: AbortController | null = null;
    setState(initial(ownerId));
    const local = async () => {
      if (disposed) return;
      if (reading) {
        readAgain = true;
        return;
      }
      reading = true;
      try {
        const device = await readCounterDevice(ownerId);
        if (!disposed)
          setState((s) => ({
            ...s,
            cached: device.snapshot,
            pending: device.pending,
            review: device.review,
            recoverOnline: device.recoverOnline,
            storageError: false,
          }));
      } catch {
        if (!disposed)
          setState((s) => ({
            ...s,
            pending: null,
            review: null,
            storageError: true,
          }));
      } finally {
        reading = false;
        if (readAgain && !disposed) {
          readAgain = false;
          void local();
        }
      }
    };
    const probe = async () => {
      if (disposed || polling || document.hidden) return;
      if (!navigator.onLine) {
        setState((s) => ({ ...s, connection: "offline" }));
        return;
      }
      polling = true;
      const controller = new AbortController();
      active = controller;
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const response = await fetch("/api/admin/counter-status", {
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (response.status === 401 || response.status === 403) {
          if (!disposed)
            setState((s) => ({ ...s, connection: "auth", current: null }));
          return;
        }
        if (!response.ok) throw Error("Counter status unavailable");
        const result = (await response.json()) as ServerState;
        if (
          result.actorId !== ownerId ||
          typeof result.enabled !== "boolean" ||
          !Object.hasOwn(result, "shift")
        )
          throw Error("Counter identity changed");
        if (!disposed)
          setState((s) => ({ ...s, connection: "online", current: result }));
      } catch {
        if (!disposed)
          setState((s) => ({
            ...s,
            connection: navigator.onLine ? "unavailable" : "offline",
          }));
      } finally {
        clearTimeout(timeout);
        polling = false;
      }
    };
    const refresh = () => {
      void local();
      void probe();
    };
    const offline = () => {
      active?.abort();
      setState((s) => ({ ...s, connection: "offline" }));
      void local();
    };
    const localChange = () => void local();
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("cafe-offline-counter")
        : null;
    if (channel) channel.onmessage = localChange;
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", offline);
    window.addEventListener("focus", refresh);
    window.addEventListener("cafe:outbox-changed", localChange);
    window.addEventListener("storage", localChange);
    document.addEventListener("visibilitychange", refresh);
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 15000);
    return () => {
      disposed = true;
      active?.abort();
      clearInterval(timer);
      channel?.close();
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("cafe:outbox-changed", localChange);
      window.removeEventListener("storage", localChange);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [ownerId]);
  if (!user) return null;
  const view = state.ownerId === ownerId ? state : initial(ownerId);
  const connection = {
    checking: "Checking…",
    online: "Online",
    offline: "Offline",
    unavailable: "Connection unavailable",
    auth: "Sign in again",
  }[view.connection];
  const Icon =
    view.connection === "online"
      ? Wifi
      : view.connection === "checking"
        ? RefreshCw
        : WifiOff;
  const fresh = view.connection === "online" && view.current;
  const cachedShift = view.current ? view.current.shift : view.cached?.shift;
  const shift = fresh
    ? !fresh.enabled
      ? "Setup needed"
      : fresh.shift
        ? `Open · ${fresh.shift.drawer.name}`
        : "Closed"
    : view.connection === "auth"
      ? "Status unavailable"
      : cachedShift
        ? `Cached · ${cachedShift.drawer.name}`
        : view.current
          ? "Last seen closed"
          : "Status unavailable";
  const pending = view.storageError
    ? "Storage unavailable"
    : view.pending === null
      ? "Checking…"
      : view.review
        ? `${view.pending} pending · ${view.review} need review`
        : view.pending
          ? `${view.pending} pending sync`
          : "No pending bills";
  const tile =
    "flex min-h-16 min-w-0 items-start gap-2 border-cream-200 px-3 py-3 sm:px-5";
  return (
    <section
      aria-label="Counter status"
      className="sticky top-16 z-20 grid grid-cols-3 border-b border-cream-200 bg-surface/95 shadow-sm backdrop-blur-md"
      aria-live="polite"
    >
      <div className={cn(tile, "border-r")}>
        <Icon
          className={cn(
            "mt-1 h-4 w-4 shrink-0",
            view.connection === "online" ? "text-circuit-700" : "text-chai-700",
          )}
          aria-hidden
        />
        <div className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-charcoal-500 sm:text-xs">
            Connection
          </span>
          <strong className="mt-1 block break-words text-xs sm:text-sm">
            {connection}
          </strong>
        </div>
      </div>
      <a
        href={
          canBusiness(user, "pos")
            ? view.recoverOnline
              ? "/admin/pos"
              : "/offline-pos.html"
            : "/admin/business?section=cash"
        }
        className={cn(tile, "border-r hover:bg-cream-100")}
      >
        <ClipboardList
          className="mt-1 h-4 w-4 shrink-0 text-chai-700"
          aria-hidden
        />
        <div className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-charcoal-500 sm:text-xs">
            Saved bills
          </span>
          <strong
            className={cn(
              "mt-1 block break-words text-xs sm:text-sm",
              view.review ? "text-chilli-600" : "",
            )}
          >
            {pending}
          </strong>
        </div>
      </a>
      <div className={tile}>
        <Wallet className="mt-1 h-4 w-4 shrink-0 text-chai-700" aria-hidden />
        <div className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-charcoal-500 sm:text-xs">
            Your shift
          </span>
          {canBusiness(user, "cash") ? (
            <Link
              href="/admin/business?section=cash"
              className="mt-1 block break-words text-xs font-bold hover:underline sm:text-sm"
            >
              {shift}
            </Link>
          ) : (
            <strong className="mt-1 block break-words text-xs sm:text-sm">
              {shift}
            </strong>
          )}
        </div>
      </div>
      {view.connection === "auth" && (
        <Link
          href="/admin/login"
          className="col-span-3 flex items-center gap-2 border-t border-cream-200 px-4 py-2 text-xs font-semibold text-chilli-600"
        >
          <AlertCircle className="h-4 w-4" aria-hidden />
          Sign in again to check the server. Saved bills remain on this device.
        </Link>
      )}
    </section>
  );
}
