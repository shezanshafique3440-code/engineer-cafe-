"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  RefreshCw,
  ShoppingBag,
  ChefHat,
  Wallet,
  Truck,
  Package,
  Users,
  BarChart3,
  Utensils,
} from "lucide-react";
import { useSession } from "@/context/session-context";
import { tasksFor } from "@/lib/cafe-tasks";
import { canBusiness } from "@/lib/business-access";
import { apiGet } from "@/lib/api-client";
import { Button } from "@/components/ui";
import { TaskSteps } from "./task-steps";
type Summary = {
  integrationActive: boolean;
  orders: number | null;
  tables: number | null;
  shift: { id: string; drawer: { name: string } } | null;
  unassigned: number | null;
};
const icons: Record<string, typeof ShoppingBag> = {
  pos: ShoppingBag,
  tables: Utensils,
  kitchen: ChefHat,
  cash: Wallet,
  delivery: Truck,
  inventory: Package,
  purchases: Package,
  staff: Users,
  overview: BarChart3,
};
export function DailyHome() {
  const { user } = useSession();
  const [data, setData] = useState<Summary | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await apiGet<Summary>("/api/admin/day-summary"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60000);
    const refresh = () => void load();
    window.addEventListener("online", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", refresh);
    };
  }, [load]);
  const tasks = tasksFor(user);
  const groups = [
    ...(user?.role === "ADMIN" || user?.businessProfile === "MANAGER"
      ? [{ id: "owner", label: "Reports & management" }]
      : []),
    { id: "daily", label: "Daily operations" },
    { id: "stock", label: "Stock & expenses" },
    { id: "team", label: "Staff" },
    ...(user?.role === "ADMIN" || user?.businessProfile === "MANAGER"
      ? []
      : [{ id: "owner", label: "Reports & management" }]),
  ];
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
            What would you like to do?
          </h1>
          <p className="mt-2 text-charcoal-600">
            Choose a task. Each screen guides you through the next step.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </header>
      {tasks[0] && (
        <Link
          href={tasks[0].href}
          className="btn-primary flex min-h-14 items-center justify-between gap-3 px-5 text-lg"
        >
          <span>Start: {tasks[0].label}</span>
          <ArrowRight className="h-5 w-5 shrink-0" />
        </Link>
      )}
      {error && (
        <p role="alert" className="surface p-4 text-chilli-600">
          Could not load live status: {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Try again
          </button>
        </p>
      )}
      {data && (
        <div
          className="grid grid-cols-2 gap-3 xl:grid-cols-4"
          aria-label="Current status"
        >
          {data.orders !== null && (
            <Status
              href="/admin/orders"
              label="Pending orders"
              value={String(data.orders)}
            />
          )}
          {data.tables !== null && (
            <Status
              href="/admin/business?section=tables"
              label="Open tables"
              value={String(data.tables)}
            />
          )}
          {canBusiness(user, "cash") && (
            <Status
              href="/admin/business?section=cash"
              label="Your cash drawer"
              value={data.shift ? "Open · " + data.shift.drawer.name : "Closed"}
            />
          )}
          {data.unassigned !== null && (
            <Status
              href="/admin/business?section=delivery"
              label="Awaiting rider assignment"
              value={String(data.unassigned)}
            />
          )}
        </div>
      )}
      {data && !data.integrationActive && (
        <div className="surface border border-chai-300 p-4">
          <p className="font-bold">Business integration is not active yet.</p>
          <p className="mt-1 text-sm">
            The owner should review real stock, recipes and opening balances
            first.
          </p>
          {canBusiness(user, "setup") && (
            <Link
              className="btn-primary mt-3"
              href="/admin/business?section=setup"
            >
              Review setup
            </Link>
          )}
        </div>
      )}
      {canBusiness(user, "cash") && data?.integrationActive && !data.shift && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-chai-50 p-4">
          <p className="font-semibold">
            Open your own shift before taking cash payments.
          </p>
          <Link className="btn-primary" href="/admin/business?section=cash">
            Open cash shift
          </Link>
        </div>
      )}
      {groups.map((group) => {
        const items = tasks.filter((t) => t.group === group.id);
        return items.length ? (
          <section key={group.id}>
            <h2 className="mb-3 text-lg font-bold">{group.label}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((task) => {
                const Icon = icons[task.id] ?? ShoppingBag;
                return (
                  <Link
                    key={task.id}
                    href={task.href}
                    className="surface group flex min-h-28 items-start gap-3 p-5 transition hover:border-chai-400 hover:shadow-md"
                  >
                    <span className="rounded-xl bg-chai-50 p-3 text-chai-700">
                      <Icon className="h-6 w-6" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block text-lg">{task.label}</strong>
                      <span className="mt-1 block text-sm text-charcoal-500">
                        {task.hint}
                      </span>
                    </span>
                    <ArrowRight className="mt-2 h-4 w-4 shrink-0" />
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null;
      })}
      {!tasks.length && (
        <p className="surface p-5">
          No tasks are assigned to this login yet. Ask the owner to review your
          staff access.
        </p>
      )}
      <TaskSteps
        title="Daily routine"
        steps={
          user?.businessProfile === "CHEF"
            ? [
                "Check new kitchen tickets",
                "Mark Preparing",
                "Mark Ready when prepared",
              ]
            : user?.businessProfile === "WAITER"
              ? [
                  "Choose your table",
                  "Send the order to the kitchen",
                  "Ask the cashier to settle payment",
                ]
              : [
                  "Open the cash shift",
                  "Record orders and payments",
                  "Count cash and close the shift",
                ]
        }
        tip="Each employee should use their own login. Do not record a payment twice."
      />
      <Link
        href="/admin/business"
        className="inline-flex min-h-11 items-center text-sm font-semibold underline"
      >
        All business workspaces
      </Link>
    </div>
  );
}
function Status({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <Link href={href} className="surface p-4">
      <span className="block text-sm text-charcoal-500">{label}</span>
      <strong className="mt-1 block break-words text-xl">{value}</strong>
    </Link>
  );
}
