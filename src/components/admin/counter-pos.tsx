"use client";
import Link from "next/link";
import {
  readSaleIntent,
  saveSaleIntent,
  clearSaleIntent,
  definiteRejection,
  type SaleIntent,
} from "@/lib/sale-intent";
import { TaskSteps } from "./task-steps";
import { OfflineCounterPanel } from "./offline-counter-panel";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Printer, Plus, Minus, Trash2 } from "lucide-react";
import { CartProvider, useCart } from "@/context/cart-context";
import { useSettings, useMoney } from "@/context/settings-context";
import { apiGet, apiPost, ApiError } from "@/lib/api-client";
import { ProductDialog } from "@/components/menu/product-dialog";
import { StorefrontProvider } from "@/context/storefront-context";
import { FavoritesProvider } from "@/context/favorites-context";
import { Button, Input, Select, Checkbox, ErrorState } from "@/components/ui";
import { buildReceiptHtml, printSlip } from "@/lib/receipt";
import type { ProductDTO } from "@/lib/types";
import type { OrderDTO } from "@/server/orders";
import { useSession } from "@/context/session-context";
import { Form, rows, text, type Row } from "@/components/business/shared";
type SalesContext = {
  enabled: boolean;
  accounts: {
    id: string;
    name: string;
    code: string;
    drawer?: { id: string } | null;
  }[];
  sessions: { id: string; table: { name: string } }[];
  customers: { id: string; name: string; creditLimit: string }[];
  shift: { id: string; drawer: { name: string; accountId: string } } | null;
};
export function CounterPOS({
  mode = "COUNTER",
  sessionId = "",
  embedded = false,
  onRecorded,
}: {
  mode?: "COUNTER" | "TABLE";
  sessionId?: string;
  embedded?: boolean;
  onRecorded?: () => void;
}) {
  const [session, setSession] = useState(sessionId);
  return (
    <FavoritesProvider>
      <CartProvider
        key={mode + session}
        scope={mode === "TABLE" ? `table:${session}` : "pos"}
      >
        <StorefrontProvider>
          <Counter
            mode={mode}
            session={session}
            setSession={setSession}
            embedded={embedded}
            onRecorded={onRecorded}
          />
        </StorefrontProvider>
      </CartProvider>
    </FavoritesProvider>
  );
}
function Counter({
  mode,
  session,
  setSession,
  embedded,
  onRecorded,
}: {
  mode: "COUNTER" | "TABLE";
  session: string;
  setSession: (id: string) => void;
  embedded: boolean;
  onRecorded?: () => void;
}) {
  const { user } = useSession();
  const cart = useCart(),
    settings = useSettings(),
    money = useMoney();
  const [products, setProducts] = useState<ProductDTO[]>([]),
    [context, setContext] = useState<SalesContext | null>(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [slug, setSlug] = useState<string | null>(null),
    [cash, setCash] = useState(""),
    [name, setName] = useState(""),
    [account, setAccount] = useState(""),
    [credit, setCredit] = useState(false),
    [party, setParty] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState<OrderDTO | null>(null),
    [requestId, setRequestId] = useState(""),
    [approvals, setApprovals] = useState<Row[]>([]),
    [approvalId, setApprovalId] = useState("");
  const table = mode === "TABLE";
  const intentKey = `cafe-sale-intent:${mode}:${session}:${user?.id || ""}`;
  const draftKey = `cafe-counter-draft:${user?.id || ""}`;
  const [pendingIntent, setPendingIntent] = useState<SaleIntent | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const latestDraft = useRef<unknown>(null);
  latestDraft.current = {
    ownerId: user?.id,
    lines: cart.toCartLinesPayload(),
    cash,
    name,
    account,
    credit,
    party,
    approvalId,
    requestId,
  };
  useEffect(() => {
    if (!user?.id) return;
    const ownerId = user.id;
    try {
      setPendingIntent(readSaleIntent(intentKey, ownerId));
      if (!table) {
        const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
        if (draft?.ownerId === ownerId) {
          setCash(draft.cash || "");
          setName(draft.name || "");
          setAccount(draft.account || "");
          setCredit(Boolean(draft.credit));
          setParty(draft.party || "");
          setApprovalId(draft.approvalId || "");
          setRequestId(draft.requestId || crypto.randomUUID());
        } else setRequestId(crypto.randomUUID());
      } else setRequestId(crypto.randomUUID());
      setDraftReady(true);
    } catch {
      setError(
        "Browser storage is unavailable. Enable device storage before recording bills safely.",
      );
    }
  }, [user?.id, intentKey, draftKey, table]);
  useEffect(() => {
    if (!draftReady || table || !cart.hydrated) return;
    const save = (event?: Event) => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(latestDraft.current));
      } catch {
        event?.preventDefault();
        toast.error(
          "Could not save this draft. Free device storage before switching screens.",
        );
      }
    };
    save();
    window.addEventListener("cafe:save-draft", save);
    return () => window.removeEventListener("cafe:save-draft", save);
  }, [
    draftReady,
    table,
    draftKey,
    cart.hydrated,
    cart.lines,
    cash,
    name,
    account,
    credit,
    party,
    approvalId,
    requestId,
  ]);
  const loadApprovals = useCallback(
    () =>
      table
        ? Promise.resolve()
        : apiGet<Row>("/api/admin/business/approvals").then((d) =>
            setApprovals(
              rows(d, "approvals").filter(
                (a) =>
                  a.requestedById === user?.id &&
                  a.kind === "DISCOUNT" &&
                  a.status === "APPROVED" &&
                  new Date(text(a, "expiresAt")) > new Date(),
              ),
            ),
          ),
    [table, user?.id],
  );
  const approved = approvals.find((a) => a.id === approvalId);
  const discount = approved ? Number(approved.amount) : 0;
  const saleTax =
    approved && cart.quote
      ? Math.round(
          (Math.max(0, cart.quote.subtotal - discount) * settings.taxPercent) /
            100,
        )
      : (cart.quote?.tax ?? 0);
  const saleTotal =
    approved && cart.quote
      ? cart.quote.subtotal - discount + saleTax + cart.quote.deliveryFee
      : (cart.quote?.total ?? 0);

  const load = () =>
    Promise.all([
      apiGet<{ products: ProductDTO[] }>("/api/meal-catalog"),
      apiGet<SalesContext>("/api/admin/sales-context"),
    ])
      .then(([d, c]) => {
        setProducts(d.products);
        setContext(c);
        setAccount(
          (current) =>
            current ||
            c.shift?.drawer.accountId ||
            c.accounts.find((a) => a.code === "CASH_MAIN")?.id ||
            "",
        );
        setError("");
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Unable to load the counter"),
      );
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    void loadApprovals().catch(() => {});
  }, [loadApprovals]);
  const setOrderType = cart.setOrderType;
  useEffect(() => setOrderType("PICKUP"), [setOrderType]);
  const complete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const payload = pendingIntent?.payload ?? {
        requestId,
        lines: cart.toCartLinesPayload(),
        expectedTotal: saleTotal,
        customerName: name.trim() || (table ? "Table guest" : "Counter guest"),
        ...(table
          ? { sessionId: session }
          : {
              shiftId: context?.shift?.id,
              approvalId: approvalId || undefined,
              cashReceived: cash ? Number(cash) : 0,
              accountId: account || undefined,
              credit,
              partyId: party || undefined,
            }),
      };
      if (!user) throw new Error("Sign in before recording a sale.");
      const intent = pendingIntent ?? {
        ownerId: user.id,
        endpoint: table ? "/api/admin/table-orders" : "/api/admin/pos",
        payload,
        createdAt: new Date().toISOString(),
        receipt: {
          cafeName: settings.cafeName,
          originalQuote: true as const,
          subtotal: cart.quote?.subtotal ?? saleTotal,
          discount,
          tax: saleTax,
          deliveryFee: cart.quote?.deliveryFee ?? 0,
          serviceMode: table ? "DINE_IN" : "TAKEAWAY",
          lines: (cart.quote?.lines ?? []).map((line, i) => ({
            name: line.productName,
            quantity: line.quantity,
            total: line.lineTotal,
            options: (cart.lines[i]?.addons ?? [])
              .map((a) => a.name)
              .join(", "),
          })),
        },
      };
      saveSaleIntent(intentKey, intent);
      setPendingIntent(intent);
      const result = await apiPost<{ order: OrderDTO }>(
        intent.endpoint,
        intent.payload,
      );
      if (!result?.order?.id)
        throw new Error("No server confirmation. Retry this original bill.");
      clearSaleIntent(intentKey);
      localStorage.removeItem(draftKey);
      setPendingIntent(null);
      setReceipt(result.order);
      setTimeout(
        () =>
          document
            .getElementById("counter-receipt")
            ?.scrollIntoView({ behavior: "smooth", block: "center" }),
        0,
      );
      onRecorded?.();
      cart.clear({ silent: true });
      setCash("");
      setApprovalId("");
      void loadApprovals().catch(() => {});
      setName("");
      setRequestId(crypto.randomUUID());
      toast.success(
        table
          ? "Table ticket sent to kitchen."
          : credit
            ? "Credit sale recorded."
            : "Payment recorded. Ticket sent to kitchen.",
      );
    } catch (e) {
      if (e instanceof ApiError && definiteRejection(e.status)) {
        clearSaleIntent(intentKey);
        setPendingIntent(null);
      }
      toast.error(
        e instanceof ApiError && e.fields
          ? Object.values(e.fields).flat()[0] || e.message
          : e instanceof Error
            ? e.message
            : "Could not record sale",
      );
    } finally {
      setBusy(false);
    }
  };
  const disabled =
    !cart.quote ||
    cart.quoting ||
    !cart.lines.length ||
    !requestId ||
    !draftReady ||
    discount > (cart.quote?.subtotal ?? 0) ||
    (table
      ? !session || !context?.enabled
      : (!credit && (!cash || Number(cash) < saleTotal)) || (credit && !party));
  if (pendingIntent)
    return (
      <section className="surface space-y-4 p-6" aria-live="polite">
        <h1 className="text-2xl font-bold">Confirm your last bill</h1>
        <p>
          This bill may already be saved. Retry checks the original bill ID and
          cannot create a second copy. Its details stay locked until the server
          confirms or rejects it.
        </p>
        <p className="text-sm">
          Bill ID: <code>{String(pendingIntent.payload.requestId)}</code>
        </p>
        <Button loading={busy} onClick={() => void complete()}>
          Check & recover bill
        </Button>
        {!table && (
          <p className="text-sm">
            If the connection is unavailable, the prepared offline counter will
            retain this bill for retry and let you take the next cash sale.
            <Link
              href="/offline-pos.html"
              className="mt-3 block font-semibold text-chai-700 underline"
            >
              Continue cash sales in the prepared offline counter
            </Link>
          </p>
        )}
      </section>
    );
  return (
    <div className="min-w-0 pb-24 xl:pb-0">
      <h1 className="text-3xl font-bold">
        {table ? "Waiter order desk" : "Counter POS"}
      </h1>
      <p className="mt-2 text-sm text-charcoal-500">
        {table
          ? "Choose an open table and send its next kitchen ticket. The cashier settles the combined bill."
          : "Receive payment, calculate change and send the ticket to the kitchen."}
      </p>
      <div className="mt-4">
        <TaskSteps
          compact
          title={table ? "Table order" : "Create a new sale"}
          steps={
            table
              ? ["Choose items", "Check bill", "Send to kitchen"]
              : ["Choose items", "Take payment", "Print receipt"]
          }
          current={!cart.lines.length ? (receipt ? 2 : 0) : 1}
        />
      </div>
      {!table && (
        <>
          <OfflineCounterPanel />
        </>
      )}
      {!embedded && (
        <div className="my-4 flex flex-wrap gap-2">
          <Link
            className="btn-secondary text-xs"
            href="/admin/business?section=tables"
          >
            Tables & bills
          </Link>
          {!table && (
            <Link
              className="btn-secondary text-xs"
              href="/admin/business?section=cash"
            >
              Open / close cash shift
            </Link>
          )}
        </div>
      )}
      {context?.enabled && !table && (
        <p className="mb-4 rounded-xl bg-chai-50 p-3 text-sm">
          {context.shift
            ? "Your cash shift: " + context.shift.drawer.name
            : "No cash shift is open under your login. Open a drawer before taking cash; bank/wallet receipts use the selected account."}
        </p>
      )}
      {table && context && !embedded && (
        <div className="surface mb-4 p-4">
          <Select
            label="Open table bill"
            value={session}
            onChange={(e) => setSession(e.target.value)}
          >
            <option value="">Choose a table…</option>
            {context.sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.table.name}
              </option>
            ))}
          </Select>
          {!context.enabled && (
            <p className="mt-2 text-sm text-chilli-600">
              The owner must finish business setup and activate table ordering.
            </p>
          )}
        </div>
      )}
      {receipt && (
        <div
          id="counter-receipt"
          role="status"
          className="surface my-5 flex flex-wrap items-center justify-between gap-3 p-4"
        >
          <p>
            <strong>#{receipt.orderNumber}</strong> · {receipt.paymentStatus}{" "}
            {money(receipt.total)}
            {receipt.cashChange !== null
              ? " · Change " + money(receipt.cashChange)
              : ""}
            {receipt.tableName ? " · " + receipt.tableName : ""}
          </p>
          <Button
            onClick={async () => {
              const win = window.open("", "_blank", "width=420,height=700");
              if (!win) {
                toast.error("Allow popups to print.");
                return;
              }
              await printSlip(
                win,
                await buildReceiptHtml(receipt, {
                  settings,
                  money,
                  origin: window.location.origin,
                }),
              );
            }}
          >
            <Printer className="h-4 w-4" />
            Print ticket
          </Button>
        </div>
      )}
      <div className="mt-6 grid min-w-0 gap-5 xl:grid-cols-[1fr_360px]">
        <section className="min-w-0">
          <Input
            type="search"
            label="Find a menu item"
            placeholder="Name or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div
            className="mt-3 flex flex-wrap gap-2"
            aria-label="Menu categories"
          >
            {["", ...new Set(products.map((p) => p.category.name))].map((c) => (
              <button
                type="button"
                key={c}
                aria-pressed={category === c}
                className={
                  category === c
                    ? "btn-primary min-h-11 text-xs"
                    : "btn-secondary min-h-11 text-xs"
                }
                onClick={() => setCategory(c)}
              >
                {c || "All items"}
              </button>
            ))}
          </div>
          {!error &&
            products.length > 0 &&
            !products.some(
              (p) =>
                (!category || p.category.name === category) &&
                `${p.name} ${p.category.name}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
            ) && (
              <p className="mt-4 rounded-xl bg-cream-50 p-4 text-sm">
                No items found. Try another search or category.
              </p>
            )}
          {error ? (
            <ErrorState description={error} onRetry={() => void load()} />
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products
                .filter(
                  (p) =>
                    (!category || p.category.name === category) &&
                    `${p.name} ${p.category.name}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((p) => (
                  <button
                    type="button"
                    key={p.id}
                    disabled={!p.isAvailable || p.stock === 0}
                    className="surface min-h-32 p-4 text-start transition hover:border-chai-500 disabled:opacity-40"
                    onClick={() =>
                      p.hasOptions || p.addonGroups?.length
                        ? setSlug(p.slug)
                        : cart.addItem(p)
                    }
                  >
                    <span className="text-xs text-charcoal-500">
                      {p.category.name}
                    </span>
                    <strong className="mt-2 block">{p.name}</strong>
                    <span className="mt-3 block font-mono text-sm text-chai-700">
                      {money(p.discountPrice || p.price)}
                    </span>
                  </button>
                ))}
            </div>
          )}
        </section>
        <section
          id="counter-bill"
          className="surface min-w-0 scroll-mt-24 self-start p-4 xl:sticky xl:top-24"
        >
          <h2 className="mb-3 text-lg font-bold">
            {table ? "Current table ticket" : "Current sale"}
          </h2>
          {!cart.lines.length && (
            <p className="py-6 text-sm text-charcoal-500">
              Select items to start.
            </p>
          )}
          {cart.lines.map((l) => (
            <div className="border-b border-cream-200 py-3" key={l.key}>
              <strong className="text-sm">{l.name}</strong>
              <p className="text-xs text-charcoal-500">
                {l.addons.map((a) => a.name).join(", ")}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="btn-secondary p-2"
                  aria-label={`Decrease ${l.name}`}
                  onClick={() => cart.decrement(l.key)}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span>{l.quantity}</span>
                <button
                  type="button"
                  className="btn-secondary p-2"
                  aria-label={`Increase ${l.name}`}
                  onClick={() => cart.increment(l.key)}
                >
                  <Plus className="h-4 w-4" />
                </button>
                <span className="ms-auto text-sm">
                  {money(
                    (l.unitPrice + l.addons.reduce((n, a) => n + a.price, 0)) *
                      l.quantity,
                  )}
                </span>
                <button
                  type="button"
                  className="p-2 text-chilli-600"
                  aria-label={`Remove ${l.name}`}
                  onClick={() => cart.removeItem(l.key)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {!table && (
            <details className="my-4 rounded-xl border border-cream-200 p-3">
              <summary className="cursor-pointer text-sm font-bold">
                Manager-approved discount
              </summary>
              <div className="mt-3 space-y-3">
                <Select
                  label="Approved discount for this cart"
                  value={approvalId}
                  onChange={(e) => {
                    setApprovalId(e.target.value);
                    setRequestId(crypto.randomUUID());
                  }}
                >
                  <option value="">No manual discount</option>
                  {approvals.map((a) => (
                    <option key={text(a, "id")} value={text(a, "id")}>
                      {money(Number(a.amount))} · {text(a, "reason")}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    void loadApprovals().catch((e) => toast.error(e.message))
                  }
                >
                  Refresh approvals
                </Button>
                {Boolean(discount) && (
                  <p className="text-sm">
                    Approved discount: {money(discount)}. Applies only to the
                    requesting cashier’s exact approved cart.
                  </p>
                )}
                <Form
                  title="Request a cart discount"
                  module="approvals"
                  fields={[
                    {
                      name: "amount",
                      label: "Discount requested (whole Rs.)",
                      type: "number",
                      min: "1",
                      step: "1",
                    },
                    { name: "reason", label: "Discount reason" },
                  ]}
                  build={(v) => ({
                    ...v,
                    action: "REQUEST",
                    kind: "DISCOUNT",
                    lines: cart.toCartLinesPayload(),
                  })}
                  onDone={() => {
                    toast.success(
                      "Sent for manager review. Refresh approvals after approval.",
                    );
                    void loadApprovals();
                  }}
                  submitLabel="Request discount"
                  disabled={!cart.lines.length}
                />
              </div>
            </details>
          )}
          {cart.quoteError && (
            <p role="alert" className="my-3 text-sm text-chilli-600">
              {cart.quoteError}
            </p>
          )}
          <dl className="my-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{money(cart.quote?.subtotal ?? 0)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Tax</dt>
              <dd>{money(saleTax)}</dd>
            </div>
            <div className="flex justify-between text-lg font-bold">
              <dt>Total</dt>
              <dd>{money(saleTotal)}</dd>
            </div>
          </dl>
          <div className="space-y-3">
            <details className="rounded-xl border border-cream-200 p-3">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">
                Customer name / Extra details
              </summary>
              <Input
                label="Customer name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </details>
            {!table && (
              <>
                {context?.enabled && (
                  <>
                    <details className="rounded-xl border border-cream-200 p-3">
                      <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">
                        Credit sale (approved customer)
                      </summary>
                      <Checkbox
                        label="Approved customer credit"
                        checked={credit}
                        onChange={(e) => setCredit(e.target.checked)}
                      />
                      {credit && (
                        <Select
                          label="Credit customer"
                          value={party}
                          onChange={(e) => setParty(e.target.value)}
                        >
                          <option value="">Choose approved customer…</option>
                          {context.customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name} · limit {money(Number(c.creditLimit))}
                            </option>
                          ))}
                        </Select>
                      )}
                    </details>
                    <Select
                      label="Payment received into"
                      value={account}
                      onChange={(e) => setAccount(e.target.value)}
                    >
                      {context.accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </Select>
                  </>
                )}
                <Input
                  label={
                    credit ? "Received now (optional)" : "Amount tendered (Rs.)"
                  }
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={1000000}
                  step="0.01"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                />
                {!credit && Boolean(cart.lines.length) && (
                  <div
                    className="flex flex-wrap gap-2"
                    aria-label="Cash shortcuts"
                  >
                    {[
                      ...new Set([
                        saleTotal,
                        Math.ceil(saleTotal / 100) * 100,
                        Math.ceil(saleTotal / 500) * 500,
                        1000,
                      ]),
                    ]
                      .filter((n) => n >= saleTotal && n > 0)
                      .map((n) => (
                        <button
                          type="button"
                          key={n}
                          className="btn-secondary min-h-11 text-sm"
                          onClick={() => setCash(String(n))}
                        >
                          {n === saleTotal ? "Exact " : ""}
                          {money(n)}
                        </button>
                      ))}
                  </div>
                )}
                {credit && (
                  <p
                    role="status"
                    className="rounded-xl bg-chai-50 p-3 font-bold"
                  >
                    Credit sale — the customer balance will increase.
                  </p>
                )}
                {!credit && (
                  <p className="text-lg font-bold">
                    Change: {money(Math.max(0, Number(cash) - saleTotal))}
                  </p>
                )}
              </>
            )}
            <Button
              className="w-full"
              loading={busy}
              disabled={disabled}
              onClick={() => void complete()}
            >
              {table
                ? "Send table ticket"
                : credit
                  ? "Record credit sale"
                  : "Record payment & send ticket"}
            </Button>
          </div>
        </section>
      </div>
      {cart.lines.length > 0 && (
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 lg:bottom-0 border-t border-cream-300 bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-lg xl:hidden lg:left-64">
          <button
            type="button"
            className="btn-primary flex w-full items-center justify-between"
            onClick={() =>
              document
                .getElementById("counter-bill")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            <span>
              {cart.lines.reduce((n, l) => n + l.quantity, 0)} items · View bill
            </span>
            <span>{money(saleTotal)}</span>
          </button>
        </div>
      )}
      {slug && (
        <ProductDialog
          slug={slug}
          open
          staffMode
          onClose={() => setSlug(null)}
        />
      )}
    </div>
  );
}
