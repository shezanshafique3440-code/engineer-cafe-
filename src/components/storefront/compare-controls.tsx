"use client";
import { T } from "@/context/language-context";
import Link from "next/link";
import { ArrowRight, GitCompareArrows, X } from "lucide-react";
import { toast } from "sonner";
import { useStorefront } from "@/context/storefront-context";
import { cn } from "@/lib/utils";
export function CompareButton({
  slug,
  name,
  compact = false,
}: {
  slug: string;
  name: string;
  compact?: boolean;
}) {
  const { compared, toggleCompare } = useStorefront();
  const selected = compared.includes(slug);
  return (
    <button
      type="button"
      aria-label={`${selected ? "Remove" : "Compare"} ${name}${selected ? " from comparison" : ""}`}
      aria-pressed={selected}
      onClick={() => {
        if (!selected && compared.length >= 3) {
          toast(
            "Compare up to 3 dishes. Remove one from your shortlist first.",
          );
          return;
        }
        toggleCompare(slug);
      }}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition",
        selected
          ? "border-chai-500 bg-chai-100 text-chai-800"
          : "border-cream-200 bg-surface hover:border-chai-400",
        compact && "w-full",
      )}
    >
      <GitCompareArrows className="h-3.5 w-3.5" aria-hidden />
      {selected ? "Shortlisted" : "Compare"}
    </button>
  );
}
export function ComparisonDock() {
  const { compared, clearCompare } = useStorefront();
  if (!compared.length) return null;
  return (
    <div className="container py-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-chai-300 bg-chai-50 p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-chai-800">
          <GitCompareArrows className="h-4 w-4" />
          {compared.length}{<T text="/3 dishes shortlisted"/>}</p>
        <div className="flex items-center gap-2">
          <Link href="/compare" className="btn-primary px-3 py-2 text-xs">
            {<T text="Compare dishes"/>}<ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={clearCompare}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-charcoal-500"
            aria-label="Clear comparison"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
