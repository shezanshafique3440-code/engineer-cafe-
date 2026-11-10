"use client";
import type { OrderDTO } from "@/server/orders";
export type CounterSnapshot = {
  user: { id: string; name: string };
  shift: { id: string; drawer: { name: string; accountId: string } } | null;
  savedAt: string;
};
export type CounterBill = {
  id: string;
  ownerId: string;
  payload: { requestId: string; expectedTotal: number };
  state: string;
  error: string;
  order?: OrderDTO;
};
export type CounterStore = {
  snapshot: (value?: unknown) => Promise<CounterSnapshot | undefined>;
  list: (owner: string) => Promise<CounterBill[]>;
  sync: (owner: string) => Promise<{ pending: number; conflicts?: number }>;
  clearSnapshot: () => Promise<void>;
};
declare global {
  interface Window {
    CafeOfflinePOS?: CounterStore;
    CafeOfflineBootstrap?: { prepareShell: () => Promise<void> };
  }
}
let loading: Promise<CounterStore> | undefined;
export function counterStore(): Promise<CounterStore> {
  if (window.CafeOfflinePOS) return Promise.resolve(window.CafeOfflinePOS);
  if (!loading)
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/offline-pos-store.js";
      script.onload = () =>
        window.CafeOfflinePOS
          ? resolve(window.CafeOfflinePOS)
          : reject(new Error("Offline counter could not initialize."));
      script.onerror = () => {
        loading = undefined;
        reject(new Error("Offline storage could not be prepared."));
      };
      document.head.appendChild(script);
    });
  return loading;
}

let bootstrap: Promise<void> | undefined;
/** Wait for the public shell cache to finish installing before declaring ready. */
export async function prepareCounterShell(): Promise<void> {
  if (!window.CafeOfflineBootstrap) {
    if (!bootstrap)
      bootstrap = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "/offline-pos-bootstrap.js";
        script.onload = () =>
          window.CafeOfflineBootstrap
            ? resolve()
            : reject(new Error("Offline preparation could not initialize."));
        script.onerror = () => {
          bootstrap = undefined;
          reject(
            new Error(
              "Offline files could not load. Stay online and try again.",
            ),
          );
        };
        document.head.appendChild(script);
      });
    await bootstrap;
  }
  await window.CafeOfflineBootstrap!.prepareShell();
}
