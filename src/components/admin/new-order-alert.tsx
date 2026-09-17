"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, BellOff } from "lucide-react";
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
  type WindowWithWebkitAudio = Window & { webkitAudioContext?: typeof AudioContext };
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
      if (!muted) playChime();
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
    <button
      type="button"
      onClick={toggleMute}
      aria-pressed={muted}
      title={muted ? "New-order sound is off" : "New-order sound is on"}
      aria-label={
        muted
          ? `Turn new-order sound on. ${pending} orders waiting.`
          : `Turn new-order sound off. ${pending} orders waiting.`
      }
      className={cn(
        "relative rounded-xl p-2 transition hover:bg-cream-100",
        muted ? "text-charcoal-300" : "text-charcoal-600",
      )}
    >
      {muted ? <BellOff className="h-5 w-5" /> : <Bell className="h-5 w-5" />}
      {pending > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-chilli-500 px-1 text-[10px] font-bold text-white">
          {pending > 9 ? "9+" : pending}
        </span>
      )}
    </button>
  );
}
