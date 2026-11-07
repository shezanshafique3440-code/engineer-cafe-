"use client";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api-client";
import { Button, Input, Select, Checkbox } from "@/components/ui";
export type Row = Record<string, unknown>;
export function get(row: Row | undefined, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (value, key) =>
        value && typeof value === "object" ? (value as Row)[key] : undefined,
      row,
    );
}
export function text(row: Row | undefined, path: string, fallback = "") {
  const v = get(row, path);
  return v === null || v === undefined ? fallback : String(v);
}
export function rows(row: Row | undefined, path: string): Row[] {
  const value = get(row, path);
  return Array.isArray(value)
    ? value.filter((v): v is Row => Boolean(v) && typeof v === "object")
    : [];
}
export function object(row: Row | undefined, path: string): Row {
  const v = get(row, path);
  return v && typeof v === "object" ? (v as Row) : {};
}
export function money(value: unknown) {
  const raw = String(value ?? "0");
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return "—";
  const [whole, fraction = ""] = raw.split(".");
  return `Rs. ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}
export const day = (value: unknown) => String(value ?? "").slice(0, 10);
export type Values = Record<string, string | boolean>;
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "number"
    | "date"
    | "month"
    | "password"
    | "email"
    | "select"
    | "checkbox"
    | "time";
  options?: { value: string; label: string }[];
  value?: string | boolean;
  required?: boolean;
  hint?: string;
  min?: string;
  max?: string;
  step?: string;
  visible?: (values: Values) => boolean;
};
export function options(items: Row[], label = "name") {
  return items.map((r) => ({ value: text(r, "id"), label: text(r, label) }));
}
export function Form({
  title,
  description,
  fields,
  module,
  build,
  onDone,
  children,
  submitLabel = "Save",
  disabled = false,
}: {
  title: string;
  description?: string;
  fields: Field[];
  module: string;
  build: (v: Values) => Row;
  onDone: () => void;
  children?: (v: Values) => ReactNode;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const [values, setValues] = useState<Values>(() =>
      Object.fromEntries(
        fields.map((f) => [
          f.name,
          f.value ?? (f.type === "checkbox" ? false : ""),
        ]),
      ),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef<{ body: string; id: string } | null>(null);
  return (
    <form
      className="surface min-w-0 p-4 sm:p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setError("");
        setBusy(true);
        try {
          const payload = build(values),
            body = JSON.stringify(payload);
          if (request.current?.body !== body)
            request.current = { body, id: crypto.randomUUID() };
          await apiPost("/api/admin/business/" + module, {
            ...payload,
            requestId: request.current!.id,
          });
          request.current = null;
          toast.success("Recorded successfully.");
          onDone();
        } catch (e) {
          const message =
            e instanceof ApiError
              ? e.fields
                ? Object.values(e.fields).flat()[0] || e.message
                : e.message
              : e instanceof Error
                ? e.message
                : "Could not record this action.";
          setError(message);
          toast.error(message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-bold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-charcoal-500">{description}</p>
      )}
      <fieldset disabled={busy || disabled} className="mt-4 space-y-4">
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          {fields
            .filter((f) => !f.visible || f.visible(values))
            .map((f) => (
              <div
                key={f.name}
                className={f.type === "checkbox" ? "sm:col-span-2" : ""}
              >
                {f.type === "checkbox" ? (
                  <Checkbox
                    label={f.label}
                    checked={Boolean(values[f.name])}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.checked }))
                    }
                    description={f.hint}
                  />
                ) : f.type === "select" ? (
                  <Select
                    label={f.label}
                    required={f.required !== false}
                    value={String(values[f.name] ?? "")}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                  >
                    <option value="">Choose…</option>
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    label={f.label}
                    hint={f.hint}
                    type={f.type ?? "text"}
                    value={String(values[f.name] ?? "")}
                    min={f.min}
                    max={f.max}
                    step={f.step ?? (f.type === "number" ? "0.01" : undefined)}
                    required={f.required !== false}
                    autoComplete={
                      f.type === "password" ? "new-password" : undefined
                    }
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.name]: e.target.value }))
                    }
                  />
                )}
              </div>
            ))}
        </div>
        {children?.(values)}
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-chilli-400/40 bg-chilli-400/10 p-3 text-sm text-chilli-600"
          >
            {error}
          </p>
        )}
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
      </fieldset>
    </form>
  );
}
export function Table({
  headers,
  children,
  empty,
}: {
  headers: string[];
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="surface min-w-0 overflow-hidden">
      <div className="max-w-full overflow-x-auto">
        <table className="w-full min-w-[640px] text-start text-sm">
          <thead className="border-b border-cream-200 bg-cream-50 text-xs uppercase text-charcoal-500">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-start"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-200">
            {empty ? (
              <tr>
                <td
                  colSpan={headers.length}
                  className="px-4 py-8 text-center text-charcoal-500"
                >
                  No records for this view yet.
                </td>
              </tr>
            ) : (
              children
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
export function Cell({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-chai-200 bg-chai-50 p-4 text-sm leading-relaxed text-chai-900">
      {children}
    </p>
  );
}
export function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: unknown;
  detail?: string;
}) {
  return (
    <div className="surface min-w-0 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase text-charcoal-500">
        {label}
      </p>
      <p className="mt-3 break-words text-2xl font-extrabold">{money(value)}</p>
      {detail && <p className="mt-2 text-xs text-charcoal-500">{detail}</p>}
    </div>
  );
}
