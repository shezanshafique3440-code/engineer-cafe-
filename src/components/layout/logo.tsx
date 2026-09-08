import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Wordmark with a small circuit-node motif — engineering hint without
 * looking like a university crest.
 */
export function Logo({
  className,
  href = "/",
  compact = false,
}: {
  className?: string;
  href?: string | null;
  compact?: boolean;
}) {
  const mark = (
    <span className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-charcoal-900 text-cream-50 shadow-soft">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path d="M5 9h11a3 3 0 0 1 0 6h-.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M5 9v5a4 4 0 0 0 4 4h2a4 4 0 0 0 4-4V9z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M8 5.5V4M12 5.5V3.5" stroke="#CE8A3C" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="18.6" cy="12" r="1.1" fill="#3DBE8B" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-lg font-extrabold tracking-tight text-charcoal-900">
            Engineer<span className="text-chai-600">Cafe</span>
          </span>
          <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-charcoal-300">
            chai · paratha · vibes
          </span>
        </span>
      )}
    </span>
  );

  if (!href) return mark;
  return (
    <Link href={href} aria-label="Engineer Cafe — home" className="rounded-xl">
      {mark}
    </Link>
  );
}
