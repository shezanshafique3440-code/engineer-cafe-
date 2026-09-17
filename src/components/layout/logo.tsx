import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Brand lockup: the Engineer Cafe badge plus the wordmark.
 *
 * `src` comes from Admin → Settings (cafe logo). When it is set that image
 * replaces the badge, so the cafe can swap in its own artwork without a code
 * change. The badge alone is used rather than the full circular lockup because
 * the lockup's two lines of text are unreadable at navbar height.
 */
export function Logo({
  className,
  href = "/",
  compact = false,
  src,
  onDark = false,
}: {
  className?: string;
  href?: string | null;
  compact?: boolean;
  /** Custom logo URL from cafe settings; falls back to the bundled badge. */
  src?: string | null;
  /** Set on dark surfaces (footer, admin sidebar) so the badge stays visible. */
  onDark?: boolean;
}) {
  const badge = src || (onDark ? "/brand/logo-mark-light.svg" : "/brand/logo-mark.svg");
  const isCustom = Boolean(src);

  const mark = (
    <span className={cn("group inline-flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl",
          // A logo uploaded by the cafe can be any colour, so give it a light
          // chip on dark surfaces instead of letting it disappear.
          isCustom && onDark ? "bg-cream-50 p-1" : "",
        )}
      >
        <Image
          src={badge}
          alt=""
          width={40}
          height={40}
          className="h-full w-full object-contain"
          priority
          unoptimized={badge.startsWith("/brand/")}
        />
      </span>

      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display text-lg font-extrabold tracking-tight",
              onDark ? "text-cream-50" : "text-charcoal-900",
            )}
          >
            Engineer<span className="text-chai-600">Cafe</span>
          </span>
          <span
            className={cn(
              "mt-0.5 font-mono text-[9px] uppercase tracking-[0.18em]",
              onDark ? "text-charcoal-500" : "text-charcoal-300",
            )}
          >
            the innovation brew
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
