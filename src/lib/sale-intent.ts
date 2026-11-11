export type SaleReceipt = {
  cafeName: string;
  originalQuote: true;
  subtotal: number;
  discount: number;
  tax: number;
  deliveryFee: number;
  serviceMode: string;
  lines: { name: string; quantity: number; total: number; options: string }[];
};
export type SaleIntent = {
  ownerId: string;
  endpoint: string;
  payload: Record<string, unknown>;
  createdAt: string;
  receipt?: SaleReceipt;
};
export function readSaleIntent(
  key: string,
  ownerId: string,
): SaleIntent | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const intent = JSON.parse(raw) as SaleIntent;
  return intent.ownerId === ownerId &&
    typeof intent.payload?.requestId === "string"
    ? intent
    : null;
}
/** Must finish before any network write: failure blocks submission rather than risking a duplicate. */
export function saveSaleIntent(key: string, intent: SaleIntent) {
  localStorage.setItem(key, JSON.stringify(intent));
}
export function definiteRejection(status: number) {
  return [400, 422].includes(status);
}
