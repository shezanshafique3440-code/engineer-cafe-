"use client";

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api-client";
import type { CartLine, ProductDTO } from "@/lib/types";

const STORAGE_KEY = "engineer-cafe-cart-v1";
const COUPON_KEY = "engineer-cafe-coupon-v1";

export type ServerQuote = {
  lines: {
    productId: string;
    productName: string;
    unitPrice: number;
    addonsTotal: number;
    quantity: number;
    lineTotal: number;
  }[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  itemCount: number;
  estimatedMinutes: number;
  coupon: { code: string; description: string | null; discount: number } | null;
  couponError: string | null;
  belowMinimum: boolean;
  minOrderAmount: number;
};

type CartValue = {
  lines: CartLine[];
  itemCount: number;
  /** Optimistic client-side subtotal — the server total always wins. */
  localSubtotal: number;
  quote: ServerQuote | null;
  quoting: boolean;
  quoteError: string | null;
  couponCode: string;
  orderType: "DELIVERY" | "PICKUP";
  hydrated: boolean;
  addItem: (
    product: Pick<ProductDTO, "id" | "name" | "slug" | "image" | "price" | "discountPrice">,
    options?: { addons?: CartLine["addons"]; quantity?: number; notes?: string; silent?: boolean },
  ) => void;
  setQuantity: (key: string, quantity: number) => void;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  removeItem: (key: string) => void;
  clear: (options?: { silent?: boolean }) => void;
  setCouponCode: (code: string) => void;
  setOrderType: (type: "DELIVERY" | "PICKUP") => void;
  refreshQuote: () => Promise<void>;
  toCartLinesPayload: () => { productId: string; quantity: number; addonIds: string[]; notes?: string }[];
};

const CartContext = createContext<CartValue | null>(null);

function lineKey(productId: string, addons: CartLine["addons"], notes?: string): string {
  const ids = addons.map((a) => a.id).sort().join("|");
  return `${productId}::${ids}::${notes ?? ""}`;
}

function readStored(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        typeof l?.productId === "string" && typeof l?.quantity === "number" && Array.isArray(l?.addons),
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [couponCode, setCouponCodeState] = useState("");
  const [orderType, setOrderType] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [quote, setQuote] = useState<ServerQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const requestId = useRef(0);

  // Restore the cart after mount so server and client markup match.
  useEffect(() => {
    setLines(readStored());
    try {
      setCouponCodeState(window.localStorage.getItem(COUPON_KEY) ?? "");
    } catch {
      /* storage unavailable — carry on with an empty coupon */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* quota or private mode — the cart still works for this session */
    }
  }, [lines, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(COUPON_KEY, couponCode);
    } catch {
      /* ignore */
    }
  }, [couponCode, hydrated]);

  const toCartLinesPayload = useCallback(
    () =>
      lines.map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        addonIds: l.addons.map((a) => a.id),
        ...(l.notes ? { notes: l.notes } : {}),
      })),
    [lines],
  );

  /** Asks the server to re-price everything. Stale responses are discarded. */
  const refreshQuote = useCallback(async () => {
    if (!hydrated) return;
    const id = ++requestId.current;

    if (lines.length === 0) {
      setQuote(null);
      setQuoteError(null);
      setQuoting(false);
      return;
    }

    setQuoting(true);
    try {
      const data = await apiPost<{ quote: ServerQuote }>("/api/cart/quote", {
        lines: toCartLinesPayload(),
        couponCode: couponCode || undefined,
        orderType,
      });
      if (id !== requestId.current) return;
      setQuote(data.quote);
      setQuoteError(null);
    } catch (error) {
      if (id !== requestId.current) return;
      setQuote(null);
      setQuoteError(
        error instanceof ApiError ? error.message : "We couldn't price your cart. Please try again.",
      );
    } finally {
      if (id === requestId.current) setQuoting(false);
    }
  }, [lines, couponCode, orderType, hydrated, toCartLinesPayload]);

  // Debounce so rapid quantity taps produce one request.
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      void refreshQuote();
    }, 250);
    return () => clearTimeout(timer);
  }, [refreshQuote, hydrated]);

  const addItem: CartValue["addItem"] = useCallback((product, options) => {
    const addons = options?.addons ?? [];
    const quantity = Math.max(1, options?.quantity ?? 1);
    const notes = options?.notes?.trim() || undefined;
    const key = lineKey(product.id, addons, notes);
    const unitPrice =
      product.discountPrice && product.discountPrice > 0 && product.discountPrice < product.price
        ? product.discountPrice
        : product.price;

    setLines((current) => {
      const existing = current.find((l) => l.key === key);
      if (existing) {
        return current.map((l) =>
          l.key === key ? { ...l, quantity: Math.min(50, l.quantity + quantity) } : l,
        );
      }
      return [
        ...current,
        {
          key,
          productId: product.id,
          name: product.name,
          slug: product.slug,
          image: product.image,
          unitPrice,
          addons,
          quantity,
          notes,
        },
      ];
    });

    if (!options?.silent) toast.success(`${product.name} added to cart`);
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((l) => l.key !== key)
        : current.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, quantity) } : l)),
    );
  }, []);

  const increment = useCallback((key: string) => {
    setLines((c) => c.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + 1) } : l)));
  }, []);

  const decrement = useCallback((key: string) => {
    setLines((c) =>
      c.flatMap((l) =>
        l.key === key ? (l.quantity <= 1 ? [] : [{ ...l, quantity: l.quantity - 1 }]) : [l],
      ),
    );
  }, []);

  const removeItem = useCallback((key: string) => {
    setLines((current) => {
      const removed = current.find((l) => l.key === key);
      if (removed) toast(`${removed.name} removed from cart`);
      return current.filter((l) => l.key !== key);
    });
  }, []);

  const clear = useCallback((options?: { silent?: boolean }) => {
    setLines([]);
    setCouponCodeState("");
    setQuote(null);
    if (!options?.silent) toast("Cart cleared");
  }, []);

  const setCouponCode = useCallback((code: string) => setCouponCodeState(code.trim().toUpperCase()), []);

  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);
  const localSubtotal = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + (l.unitPrice + l.addons.reduce((s, a) => s + a.price, 0)) * l.quantity,
        0,
      ),
    [lines],
  );

  const value = useMemo<CartValue>(
    () => ({
      lines, itemCount, localSubtotal, quote, quoting, quoteError, couponCode, orderType, hydrated,
      addItem, setQuantity, increment, decrement, removeItem, clear, setCouponCode, setOrderType,
      refreshQuote, toCartLinesPayload,
    }),
    [
      lines, itemCount, localSubtotal, quote, quoting, quoteError, couponCode, orderType, hydrated,
      addItem, setQuantity, increment, decrement, removeItem, clear, setCouponCode,
      refreshQuote, toCartLinesPayload,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>.");
  return ctx;
}
