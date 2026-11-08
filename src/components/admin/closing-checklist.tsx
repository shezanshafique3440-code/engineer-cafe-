"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/context/session-context";
import { counterStore } from "@/lib/offline-counter";
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
    [checked, setChecked] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const store = await counterStore();
        const bills = user ? await store.list(user.id) : [];
        if (active)
          setPending(
            bills.filter((b) => ["pending", "conflict"].includes(b.state))
              .length,
          );
      } catch {
        if (active)
          setError(
            "Could not check offline bills on this device. Open the offline counter and check them first.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <section className="surface space-y-4 p-5" aria-label="Before closing">
      <h2 className="text-xl font-bold">Before closing</h2>
      <ol className="list-inside list-decimal space-y-2 text-sm">
        <li>Make sure offline bills are synchronized.</li>
        <li>Review outstanding table payments and rider cash.</li>
        <li>Count the actual cash in the drawer.</li>
      </ol>
      {pending === null && !error && (
        <p role="status">Checking offline bills…</p>
      )}
      {pending !== null && (
        <p role="status" className="font-semibold">
          {pending
            ? `${pending} offline bills are pending or need review.`
            : "No offline bills are pending for this login on this device."}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {(error || (pending ?? 0) > 0) && (
        <a className="btn-primary" href="/offline-pos.html">
          Review / sync offline bills
        </a>
      )}
      <div className="flex flex-wrap gap-2">
        <Link className="btn-secondary" href="/admin/business?section=tables">
          Review tables
        </Link>
        <Link className="btn-secondary" href="/admin/business?section=delivery">
          Review rider cash
        </Link>
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
