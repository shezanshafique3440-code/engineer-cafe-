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
            "Is device ke offline bills check nahi ho sake. Offline counter khol kar pehle check karein.",
          );
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);
  return (
    <section className="surface space-y-4 p-5" aria-label="Closing se pehle">
      <h2 className="text-xl font-bold">Closing se pehle</h2>
      <ol className="list-inside list-decimal space-y-2 text-sm">
        <li>Offline bills synced hon.</li>
        <li>Pending table payments aur rider cash check hon.</li>
        <li>Ab drawer ka actual cash ginein.</li>
      </ol>
      {pending === null && !error && (
        <p role="status">Offline bills check ho rahe hain…</p>
      )}
      {pending !== null && (
        <p role="status" className="font-semibold">
          {pending
            ? `${pending} offline bills abhi pending / conflict mein hain.`
            : "Is login ke is device par koi offline bill pending nahi."}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {(error || (pending ?? 0) > 0) && (
        <a className="btn-primary" href="/offline-pos.html">
          Offline bills check / sync karein
        </a>
      )}
      <div className="flex flex-wrap gap-2">
        <Link className="btn-secondary" href="/admin/business?section=tables">
          Tables check karein
        </Link>
        <Link className="btn-secondary" href="/admin/business?section=delivery">
          Rider cash check karein
        </Link>
      </div>
      <Checkbox
        label="Maine pending kaam aur doosre devices ke bills check kar liye hain"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
      />
      <p className="text-xs text-charcoal-500">
        Yeh check sirf is browser ke is login ke bills dekh sakta hai. Doosre
        devices aur cashiers ka kaam bhi verify karein.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={
            !checked || pending === null || pending > 0 || Boolean(error)
          }
          onClick={onContinue}
        >
          Agla step: Cash ginein
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Wapas
        </Button>
      </div>
    </section>
  );
}
