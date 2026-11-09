"use client";
import { useCallback, useEffect, useRef, useState } from "react";
type Job = {
  id: string;
  kind: string;
  status: string;
  error: string | null;
  createdAt: string;
};
type Status = { maintenance: boolean; hasBulkData: boolean; jobs: Job[] };
type Preview = {
  hash: string;
  counts: Record<string, { remove: number; preserve: number }>;
  recipesToReview: number;
  cleanIngredientMasters: number;
  blockers: string[];
  total: number;
  note: string;
};
const RECORD_LABELS: Record<string, string> = {
  AddonGroup: "Extra-option groups",
  AddonGroupOnProduct: "Menu extra-option links",
  Address: "Customer addresses",
  Attendance: "Attendance entries",
  BusinessAccount: "Accounting accounts",
  BusinessAudit: "Change history",
  BusinessConfig: "Accounting settings",
  BusinessJournal: "Posted journal entries",
  BusinessParty: "Customers, suppliers and payees",
  BusinessPayment: "Payments and refunds",
  BusinessPosting: "Journal lines",
  BusinessPurchase: "Purchase invoices",
  BusinessRequest: "Saved operation receipts",
  BusinessSaleLine: "Sales report lines",
  CafeApproval: "Approval requests",
  CafePurchaseOrder: "Purchase orders",
  CafeSetting: "Cafe settings",
  CafeStockCount: "Stock counts",
  CafeTable: "Tables",
  CashDrawer: "Cash drawers",
  CashShift: "Cash shifts",
  Category: "Menu categories",
  ComboItem: "Combo items",
  ContactMessage: "Customer enquiries",
  Coupon: "Coupons",
  DeliveryCommission: "Delivery commissions",
  DeliveryRider: "Riders",
  DeliveryTransfer: "Rider payouts and collections",
  Employee: "Employees",
  Favorite: "Saved favourites",
  Ingredient: "Ingredients",
  IngredientReservation: "Stock reserved for orders",
  LoyaltyEntry: "Reward points history",
  NotificationJob: "Notification queue",
  Order: "Orders",
  OrderCounter: "Receipt number counter",
  OrderEvent: "Order status history",
  OrderItem: "Order items",
  OrderItemAddon: "Order item extras",
  PayrollRecord: "Payroll records",
  Product: "Menu products",
  ProductAddon: "Extra options",
  PurchaseLine: "Purchase invoice items",
  PushSubscription: "Notification subscriptions",
  Recipe: "Recipes",
  RecipeLine: "Recipe ingredients",
  Review: "Customer reviews",
  StaffAccess: "Staff permissions",
  StockMovement: "Stock history",
  TableSession: "Table bills",
  User: "Login accounts",
};
async function api<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "Request failed. Please try again.");
  return data;
}
export function DemoDataManager() {
  const [status, setStatus] = useState<Status | null>(null),
    [preview, setPreview] = useState<Preview | null>(null),
    [phrase, setPhrase] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const last = useRef("");
  const refresh = useCallback(async () => {
    try {
      const next = await api<Status>("/api/admin/demo-data");
      const signature = next.jobs.map((j) => j.id + j.status).join();
      if (last.current && last.current !== signature) {
        setPreview(null);
        setPhrase("");
      }
      last.current = signature;
      setStatus(next);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 4000);
    return () => clearInterval(interval);
  }, [refresh]);
  const running = status?.jobs.some((j) =>
    ["QUEUED", "RUNNING"].includes(j.status),
  );
  async function showPreview() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setPreview(await api<Preview>("/api/admin/demo-data?preview=1"));
      setPhrase("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(action: "SEED" | "CLEANUP") {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/demo-data", {
        action,
        confirmation: phrase,
        ...(action === "CLEANUP" ? { previewHash: preview?.hash } : {}),
      });
      setPreview(null);
      setPhrase("");
      setMessage(
        "Queued. Keep this page open to see progress. The worker verifies a private database backup before changing data.",
      );
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const button =
    "min-h-11 rounded-xl bg-charcoal-900 px-5 py-3 font-semibold text-white disabled:opacity-40";
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
      <header>
        <h1 className="font-display text-3xl font-bold">Demo Data</h1>
        <p className="mt-2 text-charcoal-600">
          Owner tools for testing the existing cafe system.
        </p>
      </header>
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
        <strong>This is the current business database.</strong>
        <p className="mt-2">
          DEMO sales, stock and money appear in reports while loaded. The public
          menu stays unchanged. Pause counter work, wait for offline sales to
          sync, and use the DEMO records and accounts when testing. New records
          entered manually are preserved unless their demo provenance is proven.
        </p>
        <p className="mt-2">
          Loading or resetting temporarily pauses saves and checkout while a
          verified backup is taken. If you see a maintenance message, wait for
          this job to finish and retry.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-800"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-green-50 p-4">
          {message}
        </p>
      )}
      {!status ? (
        <p>Loading demo status…</p>
      ) : (
        <>
          {running && (
            <p role="status" className="rounded-xl bg-blue-50 p-4">
              {status.maintenance
                ? "Preparing data. Saves and checkout are temporarily paused."
                : "Job queued. Waiting for the demo worker."}{" "}
              Do not start another job. If queued for more than a minute, ask
              the server administrator to check engineer-cafe-demo-worker.
            </p>
          )}
          <section className="space-y-4 rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-bold">1. Load test data</h2>
            <p>
              Add 2,000 DEMO orders across 30 days, 25 riders, 100 customers, 30
              employees, 40 ingredients, 12 suppliers and 15 tables, with
              purchases, stock usage, attendance, payroll, cash shifts,
              commissions and sample cancellations. Existing records stay.
            </p>
            <p>
              Open Cafe business system to test Riders &amp; deliveries,
              Ingredients &amp; stock, Purchases, Employees, Attendance,
              Payroll, Cash shifts and Financial reports. Open Orders or Kitchen
              for active sample tickets.
            </p>
            {status.hasBulkData ? (
              <p className="font-semibold">
                The bulk dataset is already loaded.
              </p>
            ) : (
              !preview && (
                <>
                  <label className="block">
                    Type <strong>LOAD DEMO DATA</strong>
                    <input
                      aria-label="Load confirmation"
                      className="mt-2 block min-h-11 w-full rounded-lg border p-3"
                      value={phrase}
                      onChange={(e) => setPhrase(e.target.value)}
                      disabled={busy || running}
                    />
                  </label>
                  <button
                    className={button}
                    disabled={busy || running || phrase !== "LOAD DEMO DATA"}
                    onClick={() => submit("SEED")}
                  >
                    Back up and load demo data
                  </button>
                </>
              )
            )}
          </section>
          <section className="space-y-4 rounded-2xl border bg-white p-5">
            <h2 className="text-xl font-bold">2. Review before resetting</h2>
            <p>
              Preview shows the exact removal scope and any mixed-data blockers.
              The other existing orders, owner logins, public menu, prices and
              photos are preserved.
            </p>
            <button
              className={button}
              disabled={busy || running}
              onClick={showPreview}
            >
              {busy ? "Please wait…" : "Preview cleanup"}
            </button>
            {preview && (
              <>
                <p className="font-semibold">
                  {preview.total.toLocaleString()} proven demo records to
                  remove.
                </p>
                <p>{preview.note}</p>
                <p>
                  {preview.recipesToReview} existing recipes will require
                  review. Up to {preview.cleanIngredientMasters} ingredient
                  masters will be retained or created with no fake opening
                  stock.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr>
                        <th className="p-2">Module</th>
                        <th className="p-2">Remove demo</th>
                        <th className="p-2">Preserve existing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(preview.counts)
                        .filter(([, c]) => c.remove > 0 || c.preserve > 0)
                        .map(([name, c]) => (
                          <tr className="border-t" key={name}>
                            <td className="p-2">
                              {RECORD_LABELS[name] ?? name}
                            </td>
                            <td className="p-2">{c.remove}</td>
                            <td className="p-2">{c.preserve}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {preview.blockers.length ? (
                  <div role="alert" className="rounded-xl bg-red-50 p-4">
                    <strong>
                      Reset blocked: {preview.blockers.length} mixed-data links
                      need review.
                    </strong>
                    <p>
                      No data will be deleted. Ask the administrator to
                      reconcile these records first.
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {preview.blockers.slice(0, 30).map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    {preview.blockers.length > 30 && (
                      <p>
                        And {preview.blockers.length - 30} more. Use the private
                        audit to review the complete list.
                      </p>
                    )}
                  </div>
                ) : (
                  preview.total > 0 && (
                    <div className="space-y-3 rounded-xl border border-red-300 p-4">
                      <h3 className="font-bold">3. Reset demo data</h3>
                      <p>
                        Finish testing and sync or discard training sales on
                        every counter device first. Reset deletes the listed
                        synthetic history. Review assumed recipes and enter
                        actual opening stock before live operation. A private
                        backup is retained; restoring it is a separate
                        administrator action.
                      </p>
                      <label className="block">
                        Type <strong>RESET DEMO DATA</strong>
                        <input
                          aria-label="Reset confirmation"
                          className="mt-2 block min-h-11 w-full rounded-lg border p-3"
                          value={phrase}
                          onChange={(e) => setPhrase(e.target.value)}
                          disabled={busy || running}
                        />
                      </label>
                      <button
                        className={button + " bg-red-800"}
                        disabled={
                          busy || running || phrase !== "RESET DEMO DATA"
                        }
                        onClick={() => submit("CLEANUP")}
                      >
                        Back up and reset listed demo data
                      </button>
                    </div>
                  )
                )}
              </>
            )}
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 text-xl font-bold">Recent jobs</h2>
            {!status.jobs.length ? (
              <p>No demo jobs yet.</p>
            ) : (
              <ul className="space-y-3">
                {status.jobs.map((j) => (
                  <li className="rounded-xl border p-3" key={j.id}>
                    <strong>
                      {j.kind === "SEED" ? "Load demo data" : "Reset demo data"}{" "}
                      · {j.status}
                    </strong>
                    <p className="break-all text-sm text-charcoal-500">
                      {new Date(j.createdAt).toLocaleString()} · {j.id}
                    </p>
                    {j.error && <p className="mt-1 text-red-800">{j.error}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
