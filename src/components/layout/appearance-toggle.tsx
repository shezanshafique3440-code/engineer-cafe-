"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  APPEARANCE_KEY, DARK_THEME, resolveTheme, type Appearance,
} from "@/lib/themes";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Appearance; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "auto", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

/**
 * Lets a visitor read the site in dark without overriding the cafe's branding:
 * "light" is whatever palette the cafe chose, "dark" is Midnight, "system"
 * follows the device. Hidden entirely when the cafe's own palette is already
 * dark — there is nothing to switch between.
 *
 * The preference is applied before first paint by the inline script in the
 * root layout; this component only renders the control and keeps it in sync.
 */
export function AppearanceToggle({ className }: { className?: string }) {
  const [appearance, setAppearance] = useState<Appearance>("auto");
  // Rendering nothing until mounted keeps the server markup — which cannot
  // know a localStorage value — identical to the first client render.
  const [mounted, setMounted] = useState(false);
  const [siteIsDark, setSiteIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSiteIsDark(document.documentElement.dataset.siteDark === "1");
    try {
      const stored = window.localStorage.getItem(APPEARANCE_KEY);
      if (stored === "light" || stored === "dark" || stored === "auto") {
        setAppearance(stored);
      }
    } catch {
      // Blocked storage — "auto" is the right default anyway.
    }
  }, []);

  const apply = (next: Appearance) => {
    setAppearance(next);
    try {
      window.localStorage.setItem(APPEARANCE_KEY, next);
    } catch {
      // The choice still holds for this page view.
    }
    const root = document.documentElement;
    const prefersDark =
      next === "dark" ||
      (next === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = prefersDark
      ? DARK_THEME
      : resolveTheme(root.dataset.siteTheme);
  };

  // Following the device means reacting when the device changes its mind.
  useEffect(() => {
    if (appearance !== "auto" || siteIsDark) return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      document.documentElement.dataset.theme = query.matches
        ? DARK_THEME
        : resolveTheme(document.documentElement.dataset.siteTheme);
    };
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [appearance, siteIsDark]);

  if (!mounted || siteIsDark) return null;

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-cream-300 bg-cream-100 p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const selected = option.value === appearance;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={option.label}
            onClick={() => apply(option.value)}
            className={cn(
              "rounded-full p-1.5 transition",
              selected
                ? "bg-surface text-chai-700 shadow-soft"
                : "text-charcoal-400 hover:text-charcoal-700",
            )}
          >
            <option.icon className="h-3.5 w-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
