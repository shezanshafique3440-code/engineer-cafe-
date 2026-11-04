"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Modal } from "./ui";
import { Button } from "@/components/ui";
import { Bell, BellOff, RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { useMoney } from "@/context/settings-context";
import { cn } from "@/lib/utils";

const POLL_MS = 20_000;
const MUTE_KEY = "engineer-cafe:order-alert-muted";

type Pulse = {
  pendingCount: number;
  latest: {
    id: string;
    orderNumber: string;
    customerName: string;
    total: number;
    orderType: "DELIVERY" | "PICKUP";
    placedAt: string;
  } | null;
};

/**
 * Plays a short two-tone chime through the Web Audio API. Synthesising it
 * avoids shipping an audio file, and more importantly avoids an autoplay
 * failure on a file that never finished loading.
 */
function playChime() {
  type WindowWithWebkitAudio = Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const Ctor =
    window.AudioContext ?? (window as WindowWithWebkitAudio).webkitAudioContext;
  if (!Ctor) return;

  const ctx = new Ctor();
  const now = ctx.currentTime;

  // Two rising notes, ~0.5s total — audible over a kitchen, not alarming.
  [880, 1320].forEach((frequency, index) => {
    const at = now + index * 0.18;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.25, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.32);
  });

  window.setTimeout(() => void ctx.close(), 900);
}

/**
 * Watches for incoming orders from anywhere in the admin panel and announces
 * them with a chime plus a toast. Without this the counter has to keep the
 * orders page open and refresh it by hand.
 */
export function NewOrderAlert() {
  const router = useRouter();
  const money = useMoney();
  const [pending, setPending] = useState(0);
  const [open, setOpen] = useState(false);
  const [orders, setOrders] = useState<NonNullable<Pulse["latest"]>[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await apiGet<{
          orders: NonNullable<Pulse["latest"]>[];
          total: number;
        }>("/api/admin/orders?status=PENDING&perPage=20&page=1");
        if (active) {
          setOrders(data.orders);
          setPending(data.total);
          setFailed(false);
        }
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [open, refresh]);
  const [muted, setMuted] = useState(false);

  // The newest order id already accounted for. `null` means we have not taken
  // a baseline yet, so the first poll must never fire an alert for an order
  // that was placed before this tab opened.
  const seenRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem(MUTE_KEY) === "1");
    } catch {
      // Private mode or blocked storage — default to audible.
    }
  }, []);

  const toggleMute = () => {
    setMuted((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        // Not worth surfacing; the toggle still works for this session.
      }
      return next;
    });
  };

  const announce = useCallback(
    (order: NonNullable<Pulse["latest"]>) => {
      if (!muted) {
        try {
          playChime();
        } catch {
          /* Sound must never block the notification. */
        }
      }
      toast.success(`New order #${order.orderNumber}`, {
        description: `${order.customerName} · ${money(order.total)} · ${
          order.orderType === "PICKUP" ? "Pickup" : "Delivery"
        }`,
        duration: 12_000,
        action: { label: "Open", onClick: () => router.push("/admin/orders") },
      });
    },
    [money, muted, router],
  );

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const pulse = await apiGet<Pulse>("/api/admin/orders/pulse");
        if (cancelled) return;

        setPending(pulse.pendingCount);

        const latestId = pulse.latest?.id ?? "";
        if (seenRef.current === null) {
          seenRef.current = latestId; // baseline only
        } else if (pulse.latest && latestId !== seenRef.current) {
          seenRef.current = latestId;
          announce(pulse.latest);
        }
      } catch {
        // A dropped poll is not worth a toast — the next tick retries.
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [announce]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Open order notifications"
        aria-label={`Open notifications. ${pending} orders waiting.`}
        className={cn(
          "relative flex h-11 w-11 items-center justify-center rounded-xl transition hover:bg-cream-100",
          muted ? "text-charcoal-300" : "text-charcoal-600",
        )}
      >
        <Bell className="h-5 w-5" />
        {pending > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-chilli-500 px-1 text-[10px] font-bold text-white">
            {pending > 9 ? "9+" : pending}
          </span>
        )}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Order notifications"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-charcoal-500">
            {pending} orders need confirmation
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleMute}
              aria-pressed={muted}
            >
              {muted ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              {muted ? "Sound off" : "Sound on"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Refresh notifications"
              disabled={loading}
              onClick={() => setRefresh((v) => v + 1)}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
        {failed ? (
          <p
            role="alert"
            className="rounded-xl bg-chilli-400/10 p-3 text-sm text-chilli-600"
          >
            Notifications could not refresh. Try again or open Orders.
          </p>
        ) : loading && !orders.length ? (
          <p
            role="status"
            className="py-8 text-center text-sm text-charcoal-500"
          >
            Loading pending orders…
          </p>
        ) : !orders.length ? (
          <p className="py-8 text-center text-sm text-charcoal-500">
            All caught up. No orders waiting for confirmation.
          </p>
        ) : (
          <ul className="space-y-2">
            {orders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/admin/orders?search=${encodeURIComponent(order.orderNumber)}`}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl border border-cream-200 p-4 transition hover:bg-cream-100"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong className="font-mono text-sm">
                      #{order.orderNumber}
                    </strong>
                    <strong className="text-sm text-chai-700">
                      {money(order.total)}
                    </strong>
                  </div>
                  <p className="mt-1 break-words text-sm">
                    {order.customerName}
                  </p>
                  <p className="mt-1 text-xs text-charcoal-500">
                    {order.orderType === "PICKUP" ? "Pickup" : "Delivery"} ·{" "}
                    {new Date(order.placedAt).toLocaleTimeString("en-PK", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <span className="mt-2 inline-block text-xs font-semibold text-chai-700">
                    View order →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/admin/orders?status=PENDING"
          onClick={() => setOpen(false)}
          className="btn-primary mt-5 w-full"
        >
          View all pending orders
        </Link>
        <p className="mt-3 text-xs text-charcoal-500">
          Shows up to 20 pending orders. Refreshes every 20 seconds.
        </p>
      </Modal>
    </>
  );
}
