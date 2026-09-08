"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Button ────────────────────────────────────────────────────────────── */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "dark" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};

const VARIANTS = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  dark: "btn-dark",
  danger: "btn bg-chilli-500 text-white hover:bg-chilli-600 active:scale-[.98]",
} as const;

const SIZES = { sm: "px-3.5 py-2 text-xs", md: "", lg: "px-6 py-3 text-base" } as const;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

/* ── Form fields ───────────────────────────────────────────────────────── */

type FieldWrapProps = { label?: string; error?: string; hint?: string; required?: boolean; children: ReactNode; htmlFor?: string };

export function FieldWrap({ label, error, hint, required, children, htmlFor }: FieldWrapProps) {
  return (
    <div>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-chilli-500">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="mt-1 text-xs text-charcoal-500">{hint}</p>}
      {error && (
        <p className="mt-1 text-xs font-medium text-chilli-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; hint?: string };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, className, id, required, ...props },
  ref,
) {
  const fieldId = id ?? props.name;
  return (
    <FieldWrap label={label} error={error} hint={hint} required={required} htmlFor={fieldId}>
      <input
        ref={ref}
        id={fieldId}
        className={cn("field", error && "field-error", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : undefined}
        required={required}
        {...props}
      />
    </FieldWrap>
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; hint?: string };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, className, id, required, ...props },
  ref,
) {
  const fieldId = id ?? props.name;
  return (
    <FieldWrap label={label} error={error} hint={hint} required={required} htmlFor={fieldId}>
      <textarea
        ref={ref}
        id={fieldId}
        rows={4}
        className={cn("field resize-y", error && "field-error", className)}
        aria-invalid={error ? true : undefined}
        required={required}
        {...props}
      />
    </FieldWrap>
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; hint?: string };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, className, id, required, children, ...props },
  ref,
) {
  const fieldId = id ?? props.name;
  return (
    <FieldWrap label={label} error={error} hint={hint} required={required} htmlFor={fieldId}>
      <select
        ref={ref}
        id={fieldId}
        className={cn("field cursor-pointer appearance-none bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat pr-9", error && "field-error", className)}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2357534E' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
        aria-invalid={error ? true : undefined}
        required={required}
        {...props}
      >
        {children}
      </select>
    </FieldWrap>
  );
});

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  const id = props.id ?? props.name;
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border border-cream-200 bg-white p-3 transition hover:border-chai-300",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-cream-300 text-chai-600 focus:ring-chai-500"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-charcoal-800">{label}</span>
        {description && <span className="block text-xs text-charcoal-500">{description}</span>}
      </span>
    </label>
  );
}

/* ── Badges, ratings, states ───────────────────────────────────────────── */

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "chai" | "green" | "red" | "dark";
  className?: string;
}) {
  const tones = {
    default: "bg-cream-100 text-charcoal-700",
    chai: "bg-chai-100 text-chai-700",
    green: "bg-circuit-400/15 text-circuit-600",
    red: "bg-chilli-400/15 text-chilli-600",
    dark: "bg-charcoal-900 text-cream-50",
  } as const;
  return <span className={cn("chip", tones[tone], className)}>{children}</span>;
}

export function Rating({
  value,
  count,
  size = 14,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-xs text-charcoal-600", className)}
      aria-label={`Rated ${value.toFixed(1)} out of 5${count ? ` from ${count} reviews` : ""}`}
    >
      <span className="flex" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            width={size}
            height={size}
            className={cn(
              i <= rounded ? "fill-chai-400 text-chai-400" : "fill-cream-200 text-cream-300",
            )}
          />
        ))}
      </span>
      <span className="font-semibold text-charcoal-700">{value > 0 ? value.toFixed(1) : "New"}</span>
      {count !== undefined && count > 0 && <span className="text-charcoal-300">({count})</span>}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-cream-300 bg-cream-50/60 px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-chai-100 text-chai-600">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-charcoal-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-charcoal-500">{description}</p>}
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn-primary mt-6">
          {actionLabel}
        </Link>
      )}
      {actionLabel && !actionHref && onAction && (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong.",
  description = "Please try again in a moment.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-chilli-400/30 bg-chilli-400/5 px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-chilli-600">{title}</h3>
      <p className="mt-1 text-sm text-charcoal-600">{description}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h2 className="text-2xl font-bold md:text-3xl">{title}</h2>
        {description && <p className="mt-2 text-sm text-charcoal-500 md:text-base">{description}</p>}
      </div>
      {action}
    </div>
  );
}
