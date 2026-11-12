"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, RefreshCw, Settings } from "lucide-react";
import { useSession } from "@/context/session-context";
import { adminNavigation } from "@/lib/admin-navigation";
import { canBusiness } from "@/lib/business-access";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { TaskSteps } from "./task-steps";
import { navigationIcon } from "./navigation-icons";
type Summary = {
  integrationActive: boolean;
  orders: number | null;
  tables: number | null;
  shift: { id: string; drawer: { name: string } } | null;
  unassigned: number | null;
};
export function DailyHome() {
  const { user } = useSession();
  const [stored, setData] = useState<{
      ownerId: string | undefined;
      value: Summary;
    } | null>(null),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const ownerId = user?.id;
  const revision = useRef({ value: 0 });
  const data = stored?.ownerId === ownerId ? stored?.value : null;
  const load = useCallback(async () => {
    const request = ++revision.current.value;
    setBusy(true);
    try {
      const value = await apiGet<Summary>("/api/admin/day-summary");
      if (request !== revision.current.value) return;
      setData({ ownerId, value });
      setError("");
    } catch (e) {
      if (request !== revision.current.value) return;
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      if (request === revision.current.value) setBusy(false);
    }
  }, [ownerId]);
  useEffect(() => {
    const requests = revision.current;
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    const refresh = () => void load();
    window.addEventListener("online", refresh);
    return () => {
      requests.value++;
      clearInterval(timer);
      window.removeEventListener("online", refresh);
    };
  }, [load, ownerId]);
  const { primary } = adminNavigation(user);
  const waiter = user?.businessProfile === "WAITER",
    chef = user?.businessProfile === "CHEF";
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-charcoal-500">
            {user?.name} ·{" "}
            {user?.role === "ADMIN"
              ? "Owner"
              : (user?.businessProfile ?? "Staff")}
          </p>
          <h1 className="mt-1 text-3xl font-extrabold">
            {chef ? "Kitchen desk" : waiter ? "Table service" : "Daily counter"}
          </h1>
          <p className="mt-2 text-sm text-charcoal-600">
            {chef
              ? "Follow the kitchen queue and mark each ticket as it is prepared."
              : waiter
                ? "Open your assigned table, send tickets and follow order progress."
                : "Start a sale, follow orders and close your cash shift. Everything else is in All tools & administration."}
          </p>
        </div>
        <Button variant="secondary" loading={busy} onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Refresh status
        </Button>
      </header>
      <section
        aria-label="Daily actions"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {primary.map((task, i) => {
          const Icon = navigationIcon(task.icon);
          return (
            <Link
              key={task.href}
              href={task.href}
              className={`group flex min-h-40 flex-col justify-between rounded-2xl border p-5 transition hover:shadow-md ${i === 0 ? "border-chai-600 bg-chai-600 text-white hover:bg-chai-700" : "border-cream-300 bg-surface hover:border-chai-400"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <Icon className="h-7 w-7" aria-hidden />
                <ArrowRight className="h-5 w-5" aria-hidden />
              </div>
              <div className="mt-5">
                <strong className="block text-xl">{task.label}</strong>
                <span
                  className={`mt-1 block text-sm ${i === 0 ? "text-white/85" : "text-charcoal-500"}`}
                >
                  {task.hint}
                </span>
              </div>
            </Link>
          );
        })}
      </section>
      {!primary.length && (
        <p className="surface p-5">
          No daily actions are assigned to this login. Open All tools &
          administration to see your available tools, or ask an owner to review
          access.
        </p>
      )}
      {error && (
        <p role="alert" className="surface p-4 text-sm text-chilli-600">
          Live order status is unavailable: {error}{" "}
          <button
            type="button"
            className="font-semibold underline"
            onClick={() => void load()}
          >
            Try again
          </button>
        </p>
      )}
      {data && (
        <section aria-label="Order activity" className="flex flex-wrap gap-3">
          {canBusiness(user, "orders") && data.orders !== null && (
            <Activity
              href="/admin/orders"
              label="Active orders"
              value={String(data.orders)}
            />
          )}
          {canBusiness(user, "tables") && data.tables !== null && (
            <Activity
              href="/admin/business?section=tables"
              label="Open tables"
              value={String(data.tables)}
            />
          )}
          {canBusiness(user, "delivery") && data.unassigned !== null && (
            <Activity
              href="/admin/business?section=delivery"
              label="Deliveries needing a rider"
              value={String(data.unassigned)}
            />
          )}
        </section>
      )}
      {data && !data.integrationActive && (
        <section className="surface border border-chai-300 p-4">
          <h2 className="font-bold">Opening setup needs an owner review</h2>
          <p className="mt-2 text-sm text-charcoal-600">
            Review real stock, recipes and opening balances before business
            accounting starts.
          </p>
          {canBusiness(user, "setup") && (
            <Link
              href="/admin/business?section=setup"
              className="btn-primary mt-3"
            >
              Review opening setup
            </Link>
          )}
        </section>
      )}
      {canBusiness(user, "cash") && data?.integrationActive && !data.shift && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-chai-200 bg-chai-50 p-4">
          <p className="font-semibold">
            Start the day by counting cash and opening your own shift.
          </p>
          <Link className="btn-primary" href="/admin/business?section=cash">
            Open cash shift
          </Link>
        </section>
      )}
      <Link
        href="/admin/tools"
        className="surface flex min-h-24 flex-wrap items-center justify-between gap-4 p-5 transition hover:border-chai-400"
      >
        <span className="flex items-center gap-3">
          <Settings className="h-6 w-6 shrink-0 text-chai-700" aria-hidden />
          <span>
            <strong className="block text-lg">
              All tools & administration
            </strong>
            <span className="mt-1 block text-sm text-charcoal-500">
              Reports & Excel downloads, stock, purchases, employees and website
              settings.
            </span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
      </Link>
      <Link
        href="/admin/guide"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-chai-700 underline"
      >
        Counter quick start guide
      </Link>
      <TaskSteps
        compact
        title="Daily routine"
        steps={
          chef
            ? [
                "Check new kitchen tickets",
                "Mark Preparing",
                "Mark Ready when prepared",
              ]
            : waiter
              ? [
                  "Choose your table",
                  "Send the kitchen ticket",
                  "Ask the cashier to settle payment",
                ]
              : [
                  "Open your cash shift",
                  "Record the sale and payment",
                  "Sync bills, count cash and close",
                ]
        }
        tip={
          chef || waiter
            ? "Only the actions allowed for your login are shown."
            : "Check pending sync bills before closing. Employee records do not require a separate login for every employee."
        }
      />
    </div>
  );
}
function Activity({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="surface inline-flex min-h-14 items-center gap-3 px-4 py-3 text-sm"
    >
      <span className="text-charcoal-600">{label}</span>
      <strong className="rounded-lg bg-chai-50 px-2.5 py-1 text-base text-chai-700">
        {value}
      </strong>
    </Link>
  );
}
