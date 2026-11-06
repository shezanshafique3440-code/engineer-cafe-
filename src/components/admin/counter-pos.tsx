"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Printer, Plus, Minus, Trash2 } from "lucide-react";
import { CartProvider, useCart } from "@/context/cart-context";
import { useSettings, useMoney } from "@/context/settings-context";
import { apiGet, apiPost } from "@/lib/api-client";
import { ProductDialog } from "@/components/menu/product-dialog";
import { StorefrontProvider } from "@/context/storefront-context";
import { FavoritesProvider } from "@/context/favorites-context";
import { Button, Input, ErrorState } from "@/components/ui";
import { buildReceiptHtml, printSlip } from "@/lib/receipt";
import type { ProductDTO } from "@/lib/types";
import type { OrderDTO } from "@/server/orders";
export function CounterPOS() {
  return (
    <FavoritesProvider>
      <CartProvider scope="pos">
        <StorefrontProvider>
          <Counter />
        </StorefrontProvider>
      </CartProvider>
    </FavoritesProvider>
  );
}
function Counter() {
  const cart = useCart(),
    settings = useSettings(),
    money = useMoney();
  const [products, setProducts] = useState<ProductDTO[]>([]),
    [error, setError] = useState(false),
    [query, setQuery] = useState(""),
    [slug, setSlug] = useState<string | null>(null),
    [cash, setCash] = useState(""),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [receipt, setReceipt] = useState<OrderDTO | null>(null),
    [requestId, setRequestId] = useState("");
  const load = () =>
    apiGet<{ products: ProductDTO[] }>("/api/meal-catalog")
      .then((d) => {
        setProducts(d.products);
        setError(false);
      })
      .catch(() => setError(true));
  useEffect(() => {
    void load();
    setRequestId(crypto.randomUUID());
  }, []);
  const setOrderType = cart.setOrderType;
  useEffect(() => {
    setOrderType("PICKUP");
  }, [setOrderType]);
  const complete = async () => {
    setBusy(true);
    try {
      const d = await apiPost<{ order: OrderDTO }>("/api/admin/pos", {
        requestId,
        expectedTotal: cart.quote?.total,
        lines: cart.toCartLinesPayload(),
        cashReceived: Number(cash),
        customerName: name.trim() || "Counter guest",
      });
      setReceipt(d.order);
      cart.clear({ silent: true });
      setCash("");
      setName("");
      setRequestId(crypto.randomUUID());
      toast.success("Cash recorded. Ticket sent to kitchen.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not record sale");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <h1 className="text-3xl font-bold">Counter POS</h1>
      <p className="mt-2 text-sm text-charcoal-500">
        Take cash, calculate change and send a paid ticket to the kitchen.
      </p>
      {receipt && (
        <div
          role="status"
          className="surface my-5 flex flex-wrap items-center justify-between gap-3 p-4"
        >
          <p>
            <strong>#{receipt.orderNumber}</strong> · Paid{" "}
            {money(receipt.total)} · Change {money(receipt.cashChange ?? 0)}
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
            Print receipt
          </Button>
        </div>
      )}
      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="min-w-0">
          <Input
            type="search"
            label="Find a menu item"
            placeholder="Name or category…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {error ? (
            <ErrorState onRetry={() => void load()} />
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {products
                .filter((p) =>
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
        <section className="surface self-start p-4 xl:sticky xl:top-24">
          <h2 className="mb-3 text-lg font-bold">Current sale</h2>
          {cart.lines.length === 0 && (
            <p className="py-6 text-sm text-charcoal-500">
              Select items to start a sale.
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
                  className="btn-secondary p-2"
                  aria-label={`Decrease ${l.name}`}
                  onClick={() => cart.decrement(l.key)}
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span>{l.quantity}</span>
                <button
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
                  className="p-2 text-chilli-600"
                  aria-label={`Remove ${l.name}`}
                  onClick={() => cart.removeItem(l.key)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {cart.quoteError && (
            <p role="alert" className="my-3 text-sm text-chilli-600">
              {cart.quoteError}
            </p>
          )}
          <div className="my-4 space-y-2 text-sm">
            <p className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(cart.quote?.subtotal ?? 0)}</span>
            </p>
            <p className="flex justify-between">
              <span>Tax</span>
              <span>{money(cart.quote?.tax ?? 0)}</span>
            </p>
            <p className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>{money(cart.quote?.total ?? 0)}</span>
            </p>
          </div>
          <div className="space-y-3">
            <Input
              label="Customer name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Cash received"
              type="number"
              inputMode="numeric"
              min={0}
              value={cash}
              onChange={(e) => setCash(e.target.value)}
            />
            <p className="text-lg font-bold">
              Change:{" "}
              {money(Math.max(0, Number(cash) - (cart.quote?.total ?? 0)))}
            </p>
            <Button
              className="w-full"
              loading={busy}
              disabled={
                !cart.quote ||
                cart.quoting ||
                !cash ||
                Number(cash) < cart.quote.total ||
                !cart.lines.length
              }
              onClick={() => void complete()}
            >
              Record cash & send ticket
            </Button>
          </div>
        </section>
      </div>
      {slug && <ProductDialog slug={slug} open onClose={() => setSlug(null)} />}
    </div>
  );
}
