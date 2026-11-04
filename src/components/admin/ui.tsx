"use client";

import { Children, cloneElement, isValidElement, useRef, type HTMLAttributes, type ReactNode } from "react";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-extrabold text-charcoal-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-charcoal-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "green" | "amber" | "red";
  href?: string;
}) {
  const tones = {
    default: "bg-chai-100 text-chai-600",
    green: "bg-circuit-400/15 text-circuit-600",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-chilli-400/15 text-chilli-600",
  } as const;

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">{label}</p>
        {icon && (
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 break-words text-xl font-extrabold text-charcoal-900 sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-charcoal-500">{hint}</p>}
    </>
  );

  const className = "surface p-4 transition hover:shadow-lift";
  return href ? (
    <a href={href} className={cn(className, "block hover:border-chai-300")}>{content}</a>
  ) : (
    <div className={className}>{content}</div>
  );
}

/** Accessible modal used by every admin create/edit form. */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "md" | "lg";
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, dialogRef, onClose);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6">
      <div className="fixed inset-0 bg-charcoal-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-lift sm:my-4 sm:rounded-2xl",
          size === "lg" ? "max-w-3xl" : "max-w-xl",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-cream-200 px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-charcoal-400 transition hover:bg-cream-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">{children}</div>
      </div>
    </div>
  );
}

export function DataTable({
  columns,
  children,
  empty,
}: {
  columns: string[];
  children: ReactNode;
  empty?: boolean;
}) {
  const rows = Children.map(children, row => {
    if (!isValidElement<HTMLAttributes<HTMLTableRowElement>>(row) || row.type !== "tr") return row;
    return cloneElement(row, { role: "row" }, Children.map(row.props.children, (cell, index) => {
      if (!isValidElement<HTMLAttributes<HTMLTableCellElement>>(cell) || cell.type !== "td") return cell;
      return cloneElement(cell, { "data-label": columns[index] ?? "", role: "cell" } as HTMLAttributes<HTMLTableCellElement>, <div className="admin-cell-content">{cell.props.children}</div>);
    }));
  });
  return (
    <div className="admin-data-table surface min-w-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table role="table" className="w-full min-w-[720px] text-sm">
          <thead role="rowgroup">
            <tr role="row" className="border-b border-cream-200 bg-cream-50">
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-charcoal-400"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody role="rowgroup" className="divide-y divide-cream-200">{rows}</tbody>
        </table>
      </div>
      {empty && (
        <p className="px-4 py-12 text-center text-sm text-charcoal-400">Nothing to show here yet.</p>
      )}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface overflow-hidden p-4">
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="skeleton h-8 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConfirmButton({
  onConfirm,
  message,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { onConfirm: () => void; message: string }) {
  return (
    <Button
      {...props}
      onClick={() => {
        if (window.confirm(message)) onConfirm();
      }}
    >
      {children}
    </Button>
  );
}
