"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { Check, Coffee, Moon, RotateCcw, Sun } from "lucide-react";
import { useThemeAppearance } from "@/context/theme-appearance-context";
import { THEMES, resolveTheme } from "@/lib/themes";
import { cn } from "@/lib/utils";

/** Admin-only gallery. Preview is local; Save changes publishes the palette. */
export function ThemePicker({
  value,
  saved,
  onChange,
  disabled = false,
}: {
  value: string;
  saved: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const { previewTheme, clearPreview, commitTheme } = useThemeAppearance();
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    commitTheme(saved);
  }, [saved, commitTheme]);
  useEffect(() => {
    previewTheme(value);
  }, [value, previewTheme]);
  useEffect(() => () => clearPreview(), [clearPreview]);

  const selected = resolveTheme(value);
  const savedTheme = resolveTheme(saved);
  const selectedName = THEMES.find((theme) => theme.id === selected)!.name;
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      ![
        "ArrowRight",
        "ArrowDown",
        "ArrowLeft",
        "ArrowUp",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    const buttons = Array.from(
      grid.current?.querySelectorAll<HTMLButtonElement>(
        'button[role="radio"]:not(:disabled)',
      ) ?? [],
    );
    if (!buttons.length) return;
    event.preventDefault();
    const current = buttons.findIndex(
      (button) => button === document.activeElement,
    );
    const offset =
      event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (Math.max(0, current) + offset + buttons.length) % buttons.length;
    const button = buttons[index];
    onChange(button.dataset.themeId!);
    button.focus();
  };
  return (
    <div>
      <div
        ref={grid}
        role="radiogroup"
        aria-label="Site theme"
        className="theme-preset-grid"
        onKeyDown={move}
      >
        {THEMES.map((theme) => {
          const active = selected === theme.id;
          const ModeIcon = theme.isDark ? Moon : Sun;
          return (
            <button
              key={theme.id}
              type="button"
              role="radio"
              data-theme-id={theme.id}
              aria-label={`${theme.name} theme`}
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(theme.id)}
              className={cn("theme-preset-card", active && "is-selected")}
              style={
                {
                  "--preview-paper": theme.swatch[0],
                  "--preview-accent": theme.swatch[1],
                  "--preview-ink": theme.swatch[2],
                } as CSSProperties
              }
            >
              <span className="theme-preset-scene" aria-hidden>
                <span className="theme-preset-nav">
                  <Coffee size={13} />
                  <i />
                  <i />
                </span>
                <span className="theme-preset-mini-content">
                  <span>
                    <b />
                    <b />
                    <i />
                  </span>
                  <span className="theme-preset-plate">
                    <Coffee size={27} />
                  </span>
                </span>
                <span className="theme-preset-mini-cards">
                  <i />
                  <i />
                  <i />
                </span>
              </span>
              <span className="theme-preset-caption">
                <span className="flex items-center justify-between gap-2">
                  <strong>{theme.name}</strong>
                  {active ? (
                    <Check className="h-4 w-4 text-chai-600" aria-hidden />
                  ) : (
                    <ModeIcon
                      className="h-3.5 w-3.5 text-charcoal-500"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="theme-preset-description">
                  {theme.description}
                </span>
                <span className="theme-preset-meta">
                  <span>{theme.isDark ? "Dark" : "Light"} palette</span>
                  {savedTheme === theme.id && (
                    <span className="theme-preset-saved">Saved</span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cream-200 bg-cream-50 px-4 py-3">
        <p role="status" className="text-sm text-charcoal-600">
          {selected === savedTheme
            ? `${selectedName} is your saved site theme.`
            : `Previewing ${selectedName}. Save changes to publish it for everyone.`}
        </p>
        {selected !== savedTheme && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(savedTheme)}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-chai-700"
          >
            <RotateCcw size={14} aria-hidden /> Reset preview
          </button>
        )}
      </div>
    </div>
  );
}
