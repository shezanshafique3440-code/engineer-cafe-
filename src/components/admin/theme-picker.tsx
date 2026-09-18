"use client";

import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { THEMES, resolveTheme } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Palette picker for Admin → Settings.
 *
 * Choosing a theme repaints the admin panel immediately by writing
 * `data-theme` onto <html>, so the cafe sees the palette rather than guessing
 * from three dots. The preview is only a preview: if they leave without
 * saving, the theme that is actually stored is put back on unmount.
 */
export function ThemePicker({
  value,
  saved,
  onChange,
}: {
  /** The id currently selected in the form. */
  value: string;
  /** The id last persisted, restored if this unmounts unsaved. */
  saved: string;
  onChange: (id: string) => void;
}) {
  // Kept in a ref so the cleanup below always restores the latest saved value
  // without re-running (and so flickering) every time the form changes.
  const savedRef = useRef(saved);
  savedRef.current = saved;

  useEffect(() => {
    document.documentElement.dataset.theme = resolveTheme(value);
  }, [value]);

  useEffect(() => {
    return () => {
      document.documentElement.dataset.theme = resolveTheme(savedRef.current);
    };
  }, []);

  return (
    <div role="radiogroup" aria-label="Site theme" className="grid gap-3 sm:grid-cols-2">
      {THEMES.map((theme) => {
        const selected = theme.id === value;
        return (
          <button
            key={theme.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(theme.id)}
            className={cn(
              "flex items-center gap-3 rounded-2xl border p-3 text-left transition",
              selected
                ? "border-chai-500 bg-chai-50 ring-2 ring-chai-500/30"
                : "border-cream-200 bg-surface hover:border-chai-300",
            )}
          >
            <span
              className="flex shrink-0 overflow-hidden rounded-xl border border-charcoal-900/10"
              aria-hidden
            >
              {theme.swatch.map((colour) => (
                <span key={colour} className="h-11 w-4" style={{ background: colour }} />
              ))}
            </span>

            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-sm font-bold text-charcoal-900">
                {theme.name}
                {selected && <Check className="h-3.5 w-3.5 text-chai-600" aria-hidden />}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-charcoal-500">
                {theme.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
