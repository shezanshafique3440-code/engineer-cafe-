"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/context/session-context";
import { canBusiness } from "@/lib/business-access";
import { readCounterDevice } from "@/lib/offline-counter";
import { Button, Checkbox } from "@/components/ui";
export function ClosingChecklist({
  onContinue,
  onCancel,
}: {
  onContinue: () => void;
  onCancel: () => void;
}) {
  const { user } = useSession();
  const [pending, setPending] = useState<number | null>(null),
    [error, setError] = useState(""),
    [checked, setChecked] = useState(false),
    [recoverOnline, setRecoverOnline] = useState(false);
  useEffect(() => {
    let active = true,
      reading = false,
      readAgain = false;
    setPending(null);
    setChecked(false);
    setError("");
    const refresh = async () => {
      if (!active || !user) return;
      if (reading) {
        readAgain = true;
        return;
      }
      reading = true;
      try {
        const device = await readCounterDevice(user.id);
        if (active) {
          setPending(device.pending + device.review);
          setRecoverOnline(device.recoverOnline);
          setError("");
        }
      } catch {
        if (active)
          setError(
            "Could not check saved bills on this device. Review them before closing.",
          );
      } finally {
        reading = false;
        if (readAgain && active) {
          readAgain = false;
          void refresh();
        }
      }
    };
    void refresh();
    window.addEventListener("cafe:outbox-changed", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("cafe-offline-counter")
        : null;
    if (channel) channel.onmessage = () => void refresh();
    return () => {
      active = false;
      channel?.close();
      window.removeEventListener("cafe:outbox-changed", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [user]);
  return (
    <section className="surface space-y-4 p-5" aria-label="Before closing">
      <h2 className="text-xl font-bold">Before closing</h2>
      <ol className="list-inside list-decimal space-y-2 text-sm">
        <li>Confirm the last counter bill and synchronize offline bills.</li>
        <li>Review outstanding table payments and rider cash.</li>
        <li>Count the actual cash in the drawer.</li>
      </ol>
      {pending === null && !error && <p role="status">Checking saved bills…</p>}
      {pending !== null && (
        <p role="status" className="font-semibold">
          {pending
            ? `${pending} saved bills await confirmation, sync or review.`
            : "No saved bills await confirmation or sync for this login on this device."}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {(error || (pending ?? 0) > 0) && (
        <a
          className="btn-primary"
          href={recoverOnline ? "/admin/pos" : "/offline-pos.html"}
        >
          {recoverOnline
            ? "Check & recover the last counter bill"
            : "Review / sync saved bills"}
        </a>
      )}
      <div className="flex flex-wrap gap-2">
        {canBusiness(user, "tables") && (
          <Link className="btn-secondary" href="/admin/business?section=tables">
            Review tables
          </Link>
        )}
        {canBusiness(user, "delivery") && (
          <Link
            className="btn-secondary"
            href="/admin/business?section=delivery"
          >
            Review rider cash
          </Link>
        )}
      </div>
      <Checkbox
        label="I have reviewed pending work and bills on other devices"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
      />
      <p className="text-xs text-charcoal-500">
        This check only covers this browser and login. Also verify work on other
        devices and cashier accounts.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={
            !checked || pending === null || pending > 0 || Boolean(error)
          }
          onClick={onContinue}
        >
          Next: Count cash
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Back
        </Button>
      </div>
    </section>
  );
}
