"use client";
import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import {
  counterStore,
  prepareCounterShell,
  type CounterSnapshot,
  type CounterBill,
} from "@/lib/offline-counter";
import { useSession } from "@/context/session-context";
import { Button } from "@/components/ui";
export function OfflineCounterPanel() {
  const { user } = useSession();
  const ownerId = user?.id;
  const [busy, setBusy] = useState(false);
  const [shellReady, setShellReady] = useState(false);
  const [snapshot, setSnapshot] = useState<CounterSnapshot | null>(null),
    [bills, setBills] = useState<CounterBill[]>([]),
    [message, setMessage] = useState("");
  const prepare = useCallback(async () => {
    if (!ownerId) return;
    setBusy(true);
    try {
      const store = await counterStore();
      const cached = await store.snapshot();
      setSnapshot(cached?.user.id === ownerId ? cached : null);
      setBills(await store.list(ownerId));
      if (!navigator.onLine) {
        setShellReady(Boolean(navigator.serviceWorker?.controller));
        setMessage(
          "You are offline. Use the prepared offline counter to create cash bills.",
        );
        return;
      }
      setShellReady(false);
      setMessage("Preparing offline files. Keep the internet connected…");
      await prepareCounterShell();
      setShellReady(true);
      const data = await apiGet<CounterSnapshot>("/api/admin/offline-pos");
      await store.snapshot(data);
      setSnapshot(data);
      await store.sync(ownerId).catch(() => undefined);
      setBills(await store.list(ownerId));
      setMessage(
        data.shift
          ? "This device is prepared for offline cash bills."
          : "Open your own cash shift, then prepare this device again.",
      );
    } catch (e) {
      setShellReady(false);
      setMessage(
        e instanceof Error ? e.message : "Offline counter is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }, [ownerId]);
  useEffect(() => {
    void prepare();
    const sync = async () => {
      if (!ownerId) return;
      try {
        const store = await counterStore();
        await store.sync(ownerId);
        setBills(await store.list(ownerId));
      } catch (e) {
        setMessage(
          e instanceof Error ? e.message : "Sign in before synchronizing.",
        );
      }
    };
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    const timer = setInterval(() => {
      if (!document.hidden) void sync();
    }, 30000);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
      clearInterval(timer);
    };
  }, [ownerId, prepare]);
  const outstanding = bills.filter((b) =>
    ["pending", "conflict"].includes(b.state),
  );
  return (
    <section className="surface my-3 space-y-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">
          {snapshot?.shift &&
          snapshot.user.id === ownerId &&
          shellReady &&
          !busy
            ? "✓ Offline counter ready"
            : "Offline counter preparation"}
        </h2>
        <a
          className="inline-flex min-h-11 items-center text-sm font-bold text-chai-700 underline"
          href="/offline-pos.html"
        >
          Open offline counter
        </a>
      </div>
      <p className="text-sm text-charcoal-600" role="status">
        {message}
      </p>
      {!snapshot?.shift && !busy && (
        <a
          className="inline-flex min-h-11 items-center font-semibold text-chai-700 underline"
          href="/admin/business?section=cash"
        >
          Open your own cash shift
        </a>
      )}
      <details>
        <summary className="cursor-pointer text-xs font-semibold">
          Device status / Sync / Help
        </summary>
        {snapshot?.shift && (
          <p className="text-xs text-charcoal-500">
            Prepared for {snapshot.user.name} · {snapshot.shift.drawer.name}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() => void prepare()}
          >
            Prepare / sync this device
          </Button>
          <a className="btn-secondary text-sm" href="/offline-pos.html">
            Open offline counter
          </a>
        </div>

        <details className="text-xs text-charcoal-500">
          <summary className="min-h-11 cursor-pointer py-3 font-semibold">
            Offline billing help
          </summary>
          <p>
            Offline bills are provisional. Cash-only takeaway, prepared dine-in
            tickets and prepaid delivery support add-ons, printed receipts and
            automatic reconnect sync. The server rechecks prices, stock,
            permissions and the original shift.
          </p>
        </details>
      </details>
      {outstanding.length > 0 && (
        <p role="status" className="text-sm font-semibold text-chai-700">
          {outstanding.length} bills need synchronization or review. Open the
          offline counter.
        </p>
      )}
    </section>
  );
}
