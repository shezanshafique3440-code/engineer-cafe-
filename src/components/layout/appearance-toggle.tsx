"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useThemeAppearance } from "@/context/theme-appearance-context";
import { isDarkTheme, type Appearance } from "@/lib/themes";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Appearance; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "auto", label: "System", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

/** Personal reading controls; the admin's brand palette stays in effect. */
export function AppearanceToggle({ className }: { className?: string }) {
  const { preference, siteTheme, ready, setAppearance } = useThemeAppearance();
  if (!ready) return null;
  const selectedMode =
    preference ?? (isDarkTheme(siteTheme) ? "dark" : "light");
  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full border border-cream-300 bg-cream-100 p-0.5",
        className,
      )}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={selectedMode === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => setAppearance(option.value)}
          className={cn(
            "rounded-full p-1.5 transition",
            selectedMode === option.value
              ? "bg-surface text-chai-700 shadow-soft"
              : "text-charcoal-500 hover:text-charcoal-700",
          )}
        >
          <option.icon className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
