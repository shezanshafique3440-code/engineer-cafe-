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
      setError(e instanceof Error ? e.message : "Dobara try karein.");
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
      ? [{ id: "owner", label: "Hisaab aur management" }]
      : []),
    { id: "daily", label: "Roz ka kaam" },
    { id: "stock", label: "Maal aur kharchay" },
    { id: "team", label: "Staff" },
    ...(user?.role === "ADMIN" || user?.businessProfile === "MANAGER"
      ? []
      : [{ id: "owner", label: "Hisaab aur management" }]),
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
          <h1 className="mt-1 text-3xl font-extrabold">Aaj kya karna hai?</h1>
          <p className="mt-2 text-charcoal-600">
            Apna kaam chunein. Agla step usi screen par milega.
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
          <span>Shuru karein: {tasks[0].label}</span>
          <ArrowRight className="h-5 w-5 shrink-0" />
        </Link>
      )}
      {error && (
        <p role="alert" className="surface p-4 text-chilli-600">
          Live status load nahi hua: {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Dobara load karein
          </button>
        </p>
      )}
      {data && (
        <div
          className="grid grid-cols-2 gap-3 xl:grid-cols-4"
          aria-label="Abhi ka status"
        >
          {data.orders !== null && (
            <Status
              href="/admin/orders"
              label="Orders baqi"
              value={String(data.orders)}
            />
          )}
          {data.tables !== null && (
            <Status
              href="/admin/business?section=tables"
              label="Khulay tables"
              value={String(data.tables)}
            />
          )}
          {canBusiness(user, "cash") && (
            <Status
              href="/admin/business?section=cash"
              label="Aapka cash drawer"
              value={
                data.shift
                  ? "Open · " + data.shift.drawer.name
                  : "Abhi band hai"
              }
            />
          )}
          {data.unassigned !== null && (
            <Status
              href="/admin/business?section=delivery"
              label="Rider assign karna hai"
              value={String(data.unassigned)}
            />
          )}
        </div>
      )}
      {data && !data.integrationActive && (
        <div className="surface border border-chai-300 p-4">
          <p className="font-bold">Business setup abhi active nahi hai.</p>
          <p className="mt-1 text-sm">
            Owner pehle real stock, recipes aur opening balances check kare.
          </p>
          {canBusiness(user, "setup") && (
            <Link
              className="btn-primary mt-3"
              href="/admin/business?section=setup"
            >
              Setup check karein
            </Link>
          )}
        </div>
      )}
      {canBusiness(user, "cash") && data?.integrationActive && !data.shift && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-chai-50 p-4">
          <p className="font-semibold">
            Cash sale se pehle apni shift kholein.
          </p>
          <Link className="btn-primary" href="/admin/business?section=cash">
            Cash opening karein
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
          Aapke login ko abhi kaam assign nahi hua. Owner se staff access check
          karwayein.
        </p>
      )}
      <TaskSteps
        title="Roz ka simple routine"
        steps={
          user?.businessProfile === "CHEF"
            ? [
                "Naya kitchen ticket dekhein",
                "Preparing karein",
                "Tayyar ho to Ready karein",
              ]
            : user?.businessProfile === "WAITER"
              ? [
                  "Apna table chunein",
                  "Order kitchen bhejein",
                  "Payment ke liye cashier ko batayein",
                ]
              : [
                  "Subah cash opening",
                  "Orders aur payments",
                  "Raat cash closing",
                ]
        }
        tip="Har staff apna login use kare. Recorded payment dobara enter na karein."
      />
      <Link
        href="/admin/business"
        className="inline-flex min-h-11 items-center text-sm font-semibold underline"
      >
        Saare workspaces / Full office
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
