"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui";

export type Choice = { value: string; label: string };
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "password"
    | "email"
    | "checkbox"
    | "select"
    | "multi";
  options?: Choice[];
  optional?: boolean;
  step?: string;
  value?: string | number | boolean;
};
export type FormSpec = {
  title: string;
  action: string;
  fields: Field[];
  lines?: { options: Choice[]; cost?: boolean };
  hint?: string;
};
export function OperationForm({
  spec,
  submit,
}: {
  spec: FormSpec;
  submit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [rows, setRows] = useState([0]);
  return (
    <details className="surface p-4">
      <summary className="cursor-pointer font-bold">{spec.title}</summary>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const fd = new FormData(form);
          const body: Record<string, unknown> = { action: spec.action };
          for (const f of spec.fields) {
            const v = fd.get(f.name);
            body[f.name] =
              f.type === "checkbox"
                ? v === "on"
                : f.type === "multi"
                  ? fd.getAll(f.name)
                  : f.type === "number"
                    ? Number(v)
                    : v || undefined;
          }
          if (spec.lines)
            body.lines = rows.map((i) => ({
              inventoryItemId: fd.get(`item-${i}`),
              quantity: Number(fd.get(`qty-${i}`)),
              ...(spec.lines?.cost
                ? { unitCost: Number(fd.get(`cost-${i}`)) }
                : {}),
            }));
          setBusy(true);
          setError("");
          try {
            await submit(body);
            form.reset();
            setRows([0]);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Operation failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {spec.hint && (
          <p className="text-sm text-charcoal-500 sm:col-span-2">{spec.hint}</p>
        )}
        {spec.fields.map((f) => (
          <label className="grid gap-1 text-sm" key={f.name}>
            {f.label}
            {f.type === "select" || f.type === "multi" ? (
              <select
                name={f.name}
                className="field"
                multiple={f.type === "multi"}
                required={!f.optional}
                defaultValue={f.type === "multi" ? [] : String(f.value ?? "")}
              >
                {f.type !== "multi" && <option value="">Select…</option>}
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={f.type === "checkbox" ? "h-5 w-5" : "field"}
                name={f.name}
                type={f.type || "text"}
                step={f.step || "1"}
                defaultValue={
                  typeof f.value === "boolean" ? undefined : f.value
                }
                defaultChecked={
                  f.type === "checkbox" ? Boolean(f.value) : undefined
                }
                required={f.type !== "checkbox" && !f.optional}
              />
            )}
          </label>
        ))}
        {spec.lines && (
          <div className="space-y-2 sm:col-span-2">
            {rows.map((i, index) => (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" key={i}>
                <label className="text-sm">
                  Item {index + 1}
                  <select
                    aria-label={`Item ${index + 1}`}
                    className="field"
                    name={`item-${i}`}
                    required
                  >
                    <option value="">Select ingredient</option>
                    {spec.lines?.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  Quantity
                  <input
                    aria-label={`Quantity ${index + 1}`}
                    className="field"
                    name={`qty-${i}`}
                    type="number"
                    min="0.001"
                    step="0.001"
                    required
                  />
                </label>
                {spec.lines?.cost && (
                  <label className="text-sm">
                    Unit cost (Rs.)
                    <input
                      aria-label={`Unit cost ${index + 1}`}
                      className="field"
                      name={`cost-${i}`}
                      type="number"
                      min="0"
                      step="0.0001"
                      required
                    />
                  </label>
                )}
                <button
                  type="button"
                  className="text-sm underline"
                  disabled={rows.length === 1}
                  onClick={() => setRows(rows.filter((r) => r !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-sm font-bold underline"
              onClick={() => setRows([...rows, Math.max(...rows) + 1])}
            >
              Add ingredient line
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-chilli-600 sm:col-span-2">
            {error}
          </p>
        )}
        <div className="sm:col-span-2">
          <Button loading={busy} type="submit">
            {spec.title}
          </Button>
        </div>
      </form>
    </details>
  );
}
export function OperationsTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <section className="surface overflow-hidden">
      <h2 className="border-b border-cream-200 p-4 font-bold">{title}</h2>
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-cream-100">
            <tr>
              {headers.map((h) => (
                <th className="whitespace-nowrap p-3" key={h}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr className="border-t border-cream-200" key={i}>
                {row.map((cell, j) => (
                  <td className="p-3 align-top" key={j}>
                    {cell ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="p-5 text-sm text-charcoal-500">No records yet.</p>
        )}
      </div>
    </section>
  );
}
