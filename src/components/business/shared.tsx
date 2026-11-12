"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiPost, ApiError } from "@/lib/api-client";
import { Button, Input, Select, Checkbox } from "@/components/ui";
import { StockQuantityInput } from "./stock-quantity-input";
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
    | "time"
    | "quantity";
  options?: { value: string; label: string }[];
  value?: string | boolean;
  required?: boolean;
  hint?: string | ((values: Values) => string);
  placeholder?: string;
  advanced?: boolean;
  afterContent?: boolean;
  disabled?: boolean;
  stockUnit?: string | ((values: Values) => string);
  preferLarge?: boolean;
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
  footer,
  submitLabel = "Save",
  disabled = false,
  review,
  successMessage,
}: {
  title: string;
  description?: string;
  fields: Field[];
  module: string;
  build: (v: Values) => Row;
  onDone: () => void;
  children?: (v: Values) => ReactNode;
  footer?: (v: Values) => ReactNode;
  submitLabel?: string;
  disabled?: boolean;
  review?: (v: Values) => ReactNode;
  successMessage?: string;
}) {
  const initialValues = () =>
    Object.fromEntries(
      fields.map((f) => [
        f.name,
        f.value ?? (f.type === "checkbox" ? false : ""),
      ]),
    ) as Values;
  const [values, setValues] = useState<Values>(initialValues),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [preview, setPreview] = useState<{
    payload: Row;
    details: ReactNode;
  } | null>(null);
  const request = useRef<{ body: string; id: string } | null>(null),
    submitting = useRef(false);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (preview) reviewHeading.current?.focus();
  }, [preview]);
  const save = async (payload: Row) => {
    if (submitting.current || disabled) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const body = JSON.stringify(payload);
      if (request.current?.body !== body)
        request.current = { body, id: crypto.randomUUID() };
      await apiPost("/api/admin/business/" + module, {
        ...payload,
        requestId: request.current!.id,
      });
      request.current = null;
      setPreview(null);
      setValues(initialValues());
      setSuccess(successMessage ?? "Saved successfully.");
      toast.success(successMessage ?? "Recorded successfully.");
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
      submitting.current = false;
      setBusy(false);
    }
  };
  const change = (name: string, value: string | boolean) => {
    setValues((v) => ({ ...v, [name]: value }));
    setSuccess("");
    setError("");
  };
  const renderField = (f: Field) =>
    !f.visible || f.visible(values) ? (
      <div
        key={f.name}
        className={
          f.type === "checkbox" || f.type === "quantity" ? "sm:col-span-2" : ""
        }
      >
        {f.type === "checkbox" ? (
          <Checkbox
            label={f.label}
            checked={Boolean(values[f.name])}
            onChange={(e) => change(f.name, e.target.checked)}
            description={typeof f.hint === "function" ? f.hint(values) : f.hint}
          />
        ) : f.type === "quantity" ? (
          <StockQuantityInput
            key={
              f.name +
              String(
                typeof f.stockUnit === "function"
                  ? f.stockUnit(values)
                  : f.stockUnit,
              )
            }
            label={f.label}
            base={
              typeof f.stockUnit === "function"
                ? f.stockUnit(values)
                : (f.stockUnit ?? "G")
            }
            value={String(values[f.name] ?? "")}
            onChange={(value) => change(f.name, value)}
            required={f.required !== false}
            min={f.min}
            preferLarge={f.preferLarge}
          />
        ) : f.type === "select" ? (
          <Select
            label={f.label}
            hint={typeof f.hint === "function" ? f.hint(values) : f.hint}
            disabled={f.disabled}
            required={f.required !== false}
            value={String(values[f.name] ?? "")}
            onChange={(e) => change(f.name, e.target.value)}
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
            hint={typeof f.hint === "function" ? f.hint(values) : f.hint}
            placeholder={f.placeholder}
            type={f.type ?? "text"}
            value={String(values[f.name] ?? "")}
            min={f.min}
            max={f.max}
            step={f.step ?? (f.type === "number" ? "0.01" : undefined)}
            required={f.required !== false}
            autoComplete={f.type === "password" ? "new-password" : undefined}
            onChange={(e) => change(f.name, e.target.value)}
          />
        )}
      </div>
    ) : null;
  return (
    <form
      className="surface min-w-0 p-4 sm:p-5"
      onInvalidCapture={(event) => {
        let parent = (event.target as HTMLElement).parentElement;
        while (parent) {
          if (parent instanceof HTMLDetailsElement) parent.open = true;
          parent = parent.parentElement;
        }
      }}
      onSubmit={(e) => {
        e.preventDefault();
        if (busy || disabled || preview) return;
        setError("");
        setSuccess("");
        try {
          const payload = build(values);
          if (review) setPreview({ payload, details: review(values) });
          else void save(payload);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Check the form and try again.",
          );
        }
      }}
    >
      <h2 className="text-lg font-bold">{title}</h2>
      {description && (
        <p className="mt-1 text-sm text-charcoal-500">{description}</p>
      )}
      {success && (
        <p
          role="status"
          className="mt-3 rounded-xl border border-circuit-200 bg-circuit-50 p-3 text-sm font-semibold text-circuit-800"
        >
          {success}
        </p>
      )}
      <fieldset
        disabled={busy || disabled}
        hidden={Boolean(preview)}
        className="mt-4 space-y-4"
      >
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          {fields
            .filter((f) => !f.advanced && !f.afterContent)
            .map(renderField)}
        </div>
        {children?.(values)}
        {fields.some((f) => f.afterContent) && (
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            {fields
              .filter((f) => f.afterContent && !f.advanced)
              .map(renderField)}
          </div>
        )}
        {fields.some((f) => f.advanced) && (
          <details className="rounded-xl border border-cream-200 p-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
              More details (optional)
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {fields.filter((f) => f.advanced).map(renderField)}
            </div>
          </details>
        )}
        {footer?.(values)}
        <Button type="submit" loading={busy}>
          {submitLabel}
        </Button>
        {review && (
          <p className="text-xs text-charcoal-500">
            You will review the details before anything is saved.
          </p>
        )}
      </fieldset>
      {preview && (
        <section
          aria-label="Review before saving"
          className="mt-4 space-y-4 rounded-xl border border-chai-200 bg-chai-50 p-4"
        >
          <h3
            ref={reviewHeading}
            tabIndex={-1}
            className="text-lg font-bold outline-none"
          >
            Review before saving
          </h3>
          {preview.details}
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              disabled={disabled}
              loading={busy}
              onClick={() => void save(preview.payload)}
            >
              Confirm & save
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setPreview(null);
                setError("");
              }}
            >
              Back to edit
            </Button>
          </div>
        </section>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-chilli-400/40 bg-chilli-400/10 p-3 text-sm text-chilli-600"
        >
          {error}
        </p>
      )}
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
