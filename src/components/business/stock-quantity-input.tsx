"use client";
import { useEffect, useRef, useState } from "react";
import { Input, Select } from "@/components/ui";
import {
  entryUnits,
  fromStockQuantity,
  toStockQuantity,
  preferredUnit,
  type EntryUnit,
} from "@/lib/stock-units";
/** Stores the existing base-unit decimal, while the operator enters kg/L/pieces. */
export function StockQuantityInput({
  label,
  base,
  value,
  onChange,
  required = true,
  min = "0",
  preferLarge = false,
}: {
  label: string;
  base: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  min?: string;
  preferLarge?: boolean;
}) {
  const choices = entryUnits(base);
  const initial =
    (preferLarge
      ? preferredUnit(base)
      : choices.find((u) => u.value === base)?.value) ?? choices[0].value;
  const [unit, setUnit] = useState<EntryUnit>(initial),
    [raw, setRaw] = useState(() => fromStockQuantity(value, initial));
  const [error, setError] = useState("");
  const emitted = useRef(value);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.setCustomValidity(error);
  }, [error]);
  const validUnit = choices.some((u) => u.value === unit) ? unit : initial;
  useEffect(() => {
    if (value !== emitted.current) {
      setRaw(fromStockQuantity(value, validUnit));
      emitted.current = value;
      setError("");
    }
  }, [value, validUnit]);
  return (
    <div className="min-w-0 space-y-2">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <Input
          ref={input}
          label={label}
          type="number"
          inputMode="decimal"
          min={fromStockQuantity(min, validUnit)}
          step={
            validUnit === "KG" || validUnit === "L" ? "0.0000001" : "0.0001"
          }
          required={required}
          value={raw}
          onChange={(e) => {
            const next = e.target.value;
            setRaw(next);
            try {
              const canonical =
                next === "" ? "" : toStockQuantity(next, validUnit, base);
              emitted.current = canonical;
              onChange(canonical);
              setError("");
            } catch (e) {
              emitted.current = "";
              onChange("");
              setError(e instanceof Error ? e.message : "Check the quantity.");
            }
          }}
        />
        <Select
          label="Unit"
          aria-label={"Unit for " + label}
          value={validUnit}
          onChange={(e) => {
            const next = e.target.value as EntryUnit;
            setUnit(next);
            setRaw(fromStockQuantity(value, next));
            setError("");
          }}
        >
          {choices.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </Select>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-chilli-600">
          {error}
        </p>
      ) : (
        value !== "" && (
          <p className="text-xs text-charcoal-500">
            Recorded as {value}{" "}
            {base === "ML" ? "mL" : base === "G" ? "g" : "pcs"}. Unit changes
            keep the same amount.
          </p>
        )
      )}
    </div>
  );
}
