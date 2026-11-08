"use client";
import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import {
  counterStore,
  type CounterSnapshot,
  type CounterBill,
} from "@/lib/offline-counter";
import { useSession } from "@/context/session-context";
import { Button } from "@/components/ui";
export function OfflineCounterPanel() {
  const { user } = useSession();
  const ownerId = user?.id;
  const [snapshot, setSnapshot] = useState<CounterSnapshot | null>(null),
    [bills, setBills] = useState<CounterBill[]>([]),
    [message, setMessage] = useState("");
  const prepare = useCallback(async () => {
    if (!ownerId) return;
    try {
      if ("serviceWorker" in navigator)
        await navigator.serviceWorker.register("/sw.js");
      const data = await apiGet<CounterSnapshot>("/api/admin/offline-pos");
      const store = await counterStore();
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
      setMessage(
        e instanceof Error ? e.message : "Offline counter is unavailable.",
      );
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
    return () => window.removeEventListener("online", sync);
  }, [ownerId, prepare]);
  const outstanding = bills.filter((b) =>
    ["pending", "conflict"].includes(b.state),
  );
  return (
    <section className="surface my-4 space-y-3 p-4">
      <h2 className="font-bold">Offline cash counter</h2>
      <p className="text-sm text-charcoal-600">{message}</p>
      {snapshot?.shift && (
        <p className="text-xs text-charcoal-500">
          Prepared for {snapshot.user.name} · {snapshot.shift.drawer.name}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button size="sm" variant="secondary" onClick={() => void prepare()}>
          Prepare / sync this device
        </Button>
        <a className="btn-secondary text-sm" href="/offline-pos.html">
          Open offline counter
        </a>
      </div>
      {outstanding.length > 0 && (
        <p role="status" className="text-sm font-semibold text-chai-700">
          {outstanding.length} local bills await confirmation or review. Open
          the offline counter to inspect, print, export or correct them.
        </p>
      )}
      <p className="text-xs text-charcoal-500">
        Offline bills are provisional. Cash-only takeaway, prepared dine-in
        tickets and prepaid delivery support add-ons, printed receipts and
        automatic reconnect sync. The server rechecks prices, stock, permissions
        and the original shift.
      </p>
    </section>
  );
}
