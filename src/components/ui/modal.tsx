"use client";
import { useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import { cn } from "@/lib/utils";

/** Accessible shared modal for both the cafe and admin. */
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

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6">
      <div
        className="fixed inset-0 bg-charcoal-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-charcoal-500 transition hover:bg-cream-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
