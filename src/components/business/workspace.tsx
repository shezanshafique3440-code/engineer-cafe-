"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { useSession } from "@/context/session-context";
import { canBusiness, BUSINESS_SECTIONS } from "@/lib/business-access";
import { businessToday } from "@/lib/business-math";
import { Button, Select, Input, ErrorState } from "@/components/ui";
import { IngredientsPanel, RecipesPanel } from "./stock-panels";
import { PartiesPanel, PurchasesPanel, ExpensesPanel } from "./purchase-panels";
import { StaffPanel, AttendancePanel, PayrollPanel } from "./team-panels";
import {
  OverviewPanel,
  CashPanel,
  LedgerPanel,
  SetupPanel,
  ReceivablesPanel,
} from "./finance-panels";
import { DeliveryPanel } from "./delivery-panel";
import { TablesPanel } from "./tables-panel";
import {
  ProcurementPanel,
  StockCountsPanel,
  ApprovalsPanel,
  AuditPanel,
} from "./operations-panels";
import { Notice, type Row } from "./shared";
const SECTIONS = [
  ...BUSINESS_SECTIONS,
  { id: "suppliers", label: "Supplier balances", cap: "purchases" },
  { id: "customers", label: "Credit customers", cap: "finance" },
  { id: "receivables", label: "Credit collections", cap: "payments" },
  { id: "audit", label: "Change history", cap: "finance" },
];
const MODULES: Record<string, string> = {
  inventory: "ingredients",
  expenses: "money",
  ...Object.fromEntries(SECTIONS.map((s) => [s.id, s.id])),
};
MODULES.inventory = "ingredients";
MODULES.expenses = "money";
export function BusinessWorkspace() {
  return (
    <Suspense fallback={<p className="p-5">Loading cafe workspace…</p>}>
      <Workspace />
    </Suspense>
  );
}
function Workspace() {
  const { user } = useSession(),
    params = useSearchParams(),
    router = useRouter();
  const allowed = SECTIONS.filter((s) => canBusiness(user, s.cap));
  const requested = params.get("section") ?? allowed[0]?.id;
  const section = allowed.find((s) => s.id === requested) ?? allowed[0];
  const today = businessToday();
  const [from, setFrom] = useState(today.slice(0, 7) + "-01"),
    [to, setTo] = useState(today),
    [data, setData] = useState<Row | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const moduleName = section ? MODULES[section.id] : "";
  const load = useCallback(async () => {
    if (!moduleName) return;
    setLoading(true);
    setError("");
    try {
      setData(
        await apiGet<Row>(
          "/api/admin/business/" +
            moduleName +
            "?" +
            new URLSearchParams({ from, to }),
        ),
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load this workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, [moduleName, from, to]);
  useEffect(() => {
    setData(null);
    void load();
  }, [load]);
  if (!section)
    return (
      <Notice>
        Your current staff role has no business-office access. The owner can
        assign an employee access profile.
      </Notice>
    );
  const main = data ? (
    <>
      {section.id === "delivery" ? (
        <DeliveryPanel data={data} reload={() => void load()} />
      ) : section.id === "overview" ? (
        <OverviewPanel data={data} />
      ) : section.id === "inventory" ? (
        <IngredientsPanel data={data} reload={() => void load()} />
      ) : section.id === "recipes" ? (
        <RecipesPanel data={data} reload={() => void load()} />
      ) : section.id === "purchases" ? (
        <PurchasesPanel data={data} reload={() => void load()} />
      ) : section.id === "suppliers" || section.id === "customers" ? (
        <PartiesPanel
          data={data}
          reload={() => void load()}
          customers={section.id === "customers"}
        />
      ) : section.id === "staff" ? (
        <StaffPanel data={data} reload={() => void load()} />
      ) : section.id === "attendance" ? (
        <AttendancePanel data={data} reload={() => void load()} />
      ) : section.id === "payroll" ? (
        <PayrollPanel data={data} reload={() => void load()} />
      ) : section.id === "cash" ? (
        <CashPanel data={data} reload={() => void load()} />
      ) : section.id === "expenses" ? (
        <ExpensesPanel data={data} reload={() => void load()} />
      ) : section.id === "ledger" ? (
        <LedgerPanel data={data} reload={() => void load()} />
      ) : section.id === "setup" ? (
        <SetupPanel data={data} reload={() => void load()} />
      ) : section.id === "tables" ? (
        <TablesPanel data={data} reload={() => void load()} />
      ) : section.id === "receivables" ? (
        <ReceivablesPanel data={data} reload={() => void load()} />
      ) : section.id === "procurement" ? (
        <ProcurementPanel data={data} reload={() => void load()} />
      ) : section.id === "stockcounts" ? (
        <StockCountsPanel data={data} reload={() => void load()} />
      ) : section.id === "approvals" ? (
        <ApprovalsPanel data={data} reload={() => void load()} />
      ) : section.id === "audit" ? (
        <AuditPanel data={data} />
      ) : null}
    </>
  ) : null;
  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-chai-700">
            Cafe office
          </p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
            {section.label}
          </h1>
          <p className="mt-2 text-sm text-charcoal-500">
            Orders, people, ingredients and money in one connected record.
          </p>
        </div>
        <Button
          variant="secondary"
          loading={loading}
          onClick={() => void load()}
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </header>
      <div className="surface grid gap-3 p-4 md:grid-cols-[2fr_1fr_1fr]">
        <Select
          label="Workspace"
          value={section.id}
          onChange={(e) =>
            router.push("/admin/business?section=" + e.target.value)
          }
        >
          {allowed.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <Input
          label="From"
          type="date"
          value={from}
          onChange={(e) => {
            if (e.target.value) setFrom(e.target.value);
          }}
        />
        <Input
          label="To"
          type="date"
          value={to}
          onChange={(e) => {
            if (e.target.value) setTo(e.target.value);
          }}
        />
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Business quick links">
        {allowed
          .filter((s) =>
            [
              "overview",
              "tables",
              "inventory",
              "cash",
              "payroll",
              "setup",
            ].includes(s.id),
          )
          .map((s) => (
            <Link
              key={s.id}
              href={"/admin/business?section=" + s.id}
              aria-current={s.id === section.id ? "page" : undefined}
              className={
                "rounded-full border px-3 py-2 text-xs font-semibold " +
                (s.id === section.id
                  ? "border-chai-500 bg-chai-50 text-chai-800"
                  : "border-cream-300 bg-surface text-charcoal-600")
              }
            >
              {s.label}
            </Link>
          ))}
      </nav>
      {error ? (
        <ErrorState
          title="Workspace could not load"
          description={error}
          onRetry={() => void load()}
        />
      ) : !data ? (
        <div role="status" className="grid animate-pulse gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="surface h-32 bg-cream-100" />
          ))}
        </div>
      ) : (
        main
      )}
    </div>
  );
}
