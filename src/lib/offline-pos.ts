"use client";
import type { OrderDTO } from "@/server/orders";
export type PosPayload = {
  clientId: string;
  lines: {
    productId: string;
    quantity: number;
    addonIds: string[];
    notes?: string;
  }[];
  orderType: "PICKUP" | "DELIVERY" | "DINE_IN";
  tableNumber?: string;
  customerName: string;
  customerPhone: string;
  addressLine?: string;
  shiftId: string;
  couponCode?: string;
  discount: number;
  expectedTotal: number;
  paid: boolean;
  paymentMethod: "CASH_AT_COUNTER" | "CASH_ON_DELIVERY";
};
export type PosReceipt = {
  cafeName: string;
  lines: { name: string; quantity: number; total: number; options?: string }[];
};
export type LocalBill = {
  id: string;
  ownerId: string;
  payload: PosPayload;
  receipt: PosReceipt;
  state: "pending" | "conflict" | "synced" | "discarded";
  createdAt: string;
  error: string;
  order?: OrderDTO;
};
export type PosStore = {
  list: (owner: string) => Promise<LocalBill[]>;
  queue: (
    owner: string,
    payload: PosPayload,
    receipt: PosReceipt,
  ) => Promise<LocalBill>;
  sync: (owner: string) => Promise<void>;
  snapshot: (value?: unknown) => Promise<unknown>;
  retry: (owner: string, id: string) => Promise<void>;
  discard: (owner: string, id: string) => Promise<void>;
  print: (bill: LocalBill) => void;
  clearSnapshot: () => Promise<void>;
};
declare global {
  interface Window {
    CafePOS?: PosStore;
  }
}
let loading: Promise<PosStore> | undefined;
export function posStore(): Promise<PosStore> {
  if (window.CafePOS) return Promise.resolve(window.CafePOS);
  if (!loading)
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/pos-store.js";
      script.onload = () =>
        window.CafePOS
          ? resolve(window.CafePOS)
          : reject(new Error("Offline storage unavailable."));
      script.onerror = () => {
        loading = undefined;
        reject(new Error("Unable to load offline storage."));
      };
      document.head.appendChild(script);
    });
  return loading;
}
