import { decimal, quantity, fixed } from "./business-math";
export type StockUnit = "G" | "ML" | "PCS";
export type EntryUnit = StockUnit | "KG" | "L";
export const entryUnits = (
  base: string,
): { value: EntryUnit; label: string }[] =>
  base === "G"
    ? [
        { value: "KG", label: "Kilograms (kg)" },
        { value: "G", label: "Grams (g)" },
      ]
    : base === "ML"
      ? [
          { value: "L", label: "Litres (L)" },
          { value: "ML", label: "Millilitres (mL)" },
        ]
      : [{ value: "PCS", label: "Pieces" }];
export const preferredUnit = (base: string): EntryUnit =>
  base === "G" ? "KG" : base === "ML" ? "L" : "PCS";
const large = (unit: EntryUnit) => unit === "KG" || unit === "L";
const trim = (value: string) =>
  value.includes(".") ? value.replace(/\.?0+$/, "") : value;
export function toStockQuantity(
  raw: string,
  unit: EntryUnit,
  base: string,
): string {
  if (!entryUnits(base).some((u) => u.value === unit))
    throw Error("Choose a matching quantity unit.");
  if (!/^\d{1,12}(?:\.\d{1,7})?$/.test(raw))
    throw Error("Enter a positive quantity.");
  const scale = large(unit) ? 7 : 4;
  const result = trim(decimal(fixed(raw, scale), 4));
  if (result.split(".")[0].length > 12) throw Error("Quantity is too large.");
  return result;
}
export function fromStockQuantity(value: string, unit: EntryUnit): string {
  if (value === "") return "";
  return trim(decimal(quantity(value), large(unit) ? 7 : 4));
}
export function stockAmount(value: string, base: string): string {
  try {
    const q = quantity(value),
      abs = q < 0n ? -q : q;
    const unit: EntryUnit =
      base === "G"
        ? abs >= 10000000n
          ? "KG"
          : "G"
        : base === "ML"
          ? abs >= 10000000n
            ? "L"
            : "ML"
          : "PCS";
    return (
      fromStockQuantity(value, unit) +
      " " +
      { KG: "kg", G: "g", L: "L", ML: "mL", PCS: "pcs" }[unit]
    );
  } catch {
    return value + " " + base;
  }
}
