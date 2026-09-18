/**
 * The palettes a cafe can choose from in Admin → Settings.
 *
 * Each id matches a `[data-theme="…"]` block in globals.css, where the actual
 * colours live. Keeping the list here — rather than reading it out of CSS —
 * gives the admin picker its labels and swatches, and gives the settings API a
 * closed set to validate against, so an unknown value can never reach <html>.
 */
export const THEMES = [
  {
    id: "chai",
    name: "Chai",
    description: "Warm cream and brown. The house palette.",
    swatch: ["#F8F3EA", "#B9722A", "#232020"],
    isDark: false,
  },
  {
    id: "midnight",
    name: "Midnight",
    description: "Dark mode — amber on near-black, easy at 2 AM.",
    swatch: ["#1F1C1A", "#E0A560", "#F7F5F3"],
    isDark: true,
  },
  {
    id: "matcha",
    name: "Matcha",
    description: "Cool green. Lighter and fresher.",
    swatch: ["#F0F6EE", "#4A943C", "#202521"],
    isDark: false,
  },
  {
    id: "saffron",
    name: "Saffron",
    description: "Bright gold. Food photography reads well on it.",
    swatch: ["#FEF6E6", "#D4910E", "#24201B"],
    isDark: false,
  },
  {
    id: "gulabi",
    name: "Gulabi",
    description: "Kashmiri chai pink. The softest of the light themes.",
    swatch: ["#FDF2F5", "#C74E78", "#251F22"],
    isDark: false,
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Near-monochrome, so the food is the only colour.",
    swatch: ["#F4F4F2", "#52524D", "#222220"],
    isDark: false,
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_IDS = THEMES.map((t) => t.id) as readonly string[];

export const DEFAULT_THEME: ThemeId = "chai";

/** Narrows an arbitrary stored string to a theme we actually ship. */
export function resolveTheme(value: string | null | undefined): ThemeId {
  return THEME_IDS.includes(value ?? "") ? (value as ThemeId) : DEFAULT_THEME;
}

/** Browser chrome colour for the address bar, per theme. */
export const THEME_COLOR: Record<ThemeId, string> = {
  chai: "#B9722A",
  midnight: "#1F1C1A",
  matcha: "#4A943C",
  saffron: "#D4910E",
  gulabi: "#C74E78",
  graphite: "#52524D",
};

/** The palette used when a visitor asks for dark mode. */
export const DARK_THEME: ThemeId = "midnight";

/** True when the cafe's own palette is already dark. */
export function isDarkTheme(id: string): boolean {
  return THEMES.some((t) => t.id === id && t.isDark);
}

export type Appearance = "auto" | "light" | "dark";

export const APPEARANCE_KEY = "engineer-cafe:appearance";

/**
 * Runs as a blocking inline script in <head>, before the first paint, so a
 * visitor who chose dark never sees a flash of the cafe's light palette.
 * Kept as a string because it must execute before React loads.
 */
export const APPEARANCE_SCRIPT = `(function(){try{
var r=document.documentElement,s=r.dataset.siteTheme;
if(r.dataset.siteDark==="1")return;
var p=localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)})||"auto";
var d=p==="dark"||(p==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches);
r.dataset.theme=d?${JSON.stringify(DARK_THEME)}:s;
}catch(e){}})();`;
