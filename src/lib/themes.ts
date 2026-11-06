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
    description: "Cream, caramel and gold. Shared by the cafe and admin.",
    swatch: ["#FBF7EF", "#A0703A", "#2B1E15"],
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
  {
    id: "ocean",
    name: "Ocean",
    description: "Coastal blue, clean paper and a cool modern finish.",
    swatch: ["#F3F8FC", "#236A99", "#152B3C"],
    isDark: false,
  },
  {
    id: "royal",
    name: "Royal",
    description: "Plum and lavender with a quiet, elegant feel.",
    swatch: ["#F8F4FC", "#7950A0", "#2D1F3E"],
    isDark: false,
  },
  {
    id: "terracotta",
    name: "Terracotta",
    description: "Clay, warm ivory and rust for an earthy cafe.",
    swatch: ["#FCF5EF", "#AC5038", "#3E261E"],
    isDark: false,
  },
  {
    id: "espresso",
    name: "Espresso",
    description: "Deep chocolate, soft copper and an evening mood.",
    swatch: ["#211714", "#DBAC8C", "#F9EEE6"],
    isDark: true,
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
  chai: "#81542B",
  midnight: "#1F1C1A",
  matcha: "#4A943C",
  saffron: "#D4910E",
  gulabi: "#C74E78",
  graphite: "#52524D",
  ocean: "#236A99",
  royal: "#7950A0",
  terracotta: "#AC5038",
  espresso: "#211714",
};

/** Chai's dark counterpart; other brand families use THEME_MODES below. */
export const DARK_THEME: ThemeId = "midnight";

/** True when the cafe's own palette is already dark. */
export function isDarkTheme(id: string): boolean {
  return THEMES.some((t) => t.id === id && t.isDark);
}

export type Appearance = "auto" | "light" | "dark";

export const APPEARANCE_KEY = "engineer-cafe:appearance";

/** Only base themes are selectable/persisted by admins; modes stay personal. */
export const THEME_MODES = {
  chai: { light: "chai", dark: "midnight" },
  midnight: { light: "chai", dark: "midnight" },
  matcha: { light: "matcha", dark: "matcha-dark" },
  saffron: { light: "saffron", dark: "saffron-dark" },
  gulabi: { light: "gulabi", dark: "gulabi-dark" },
  graphite: { light: "graphite", dark: "graphite-dark" },
  ocean: { light: "ocean", dark: "ocean-dark" },
  royal: { light: "royal", dark: "royal-dark" },
  terracotta: { light: "terracotta", dark: "terracotta-dark" },
  espresso: { light: "espresso-light", dark: "espresso" },
} as const satisfies Record<ThemeId, { light: string; dark: string }>;

export type ThemeVariant = (typeof THEME_MODES)[ThemeId]["light" | "dark"];

export const VARIANT_COLOR: Record<ThemeVariant, string> = {
  ...THEME_COLOR,
  "matcha-dark": "#17241B",
  "saffron-dark": "#282016",
  "gulabi-dark": "#291C25",
  "graphite-dark": "#202225",
  "ocean-dark": "#172632",
  "royal-dark": "#241C33",
  "terracotta-dark": "#2C201C",
  "espresso-light": "#7E4C39",
};

export function resolveAppearance(
  value: string | null | undefined,
): Appearance | null {
  return value === "light" || value === "dark" || value === "auto"
    ? value
    : null;
}

export function appearanceTheme(
  site: string | null | undefined,
  appearance: Appearance | null,
  systemDark = false,
): ThemeVariant {
  const theme = resolveTheme(site);
  // With no explicit personal preference, the cafe's exact saved theme wins.
  if (!appearance) return theme;
  const mode =
    appearance === "auto" ? (systemDark ? "dark" : "light") : appearance;
  return THEME_MODES[theme][mode];
}

/**
 * Runs as a blocking inline script in <head>, before the first paint, so a
 * visitor who chose dark never sees a flash of the cafe's light palette.
 * Kept as a string because it must execute before React loads.
 */
export const APPEARANCE_SCRIPT = `(function(){try{
var r=document.documentElement,s=r.dataset.siteTheme,m=${JSON.stringify(THEME_MODES)};
if(!Object.prototype.hasOwnProperty.call(m,s))s=${JSON.stringify(DEFAULT_THEME)};
var p=null;try{p=localStorage.getItem(${JSON.stringify(APPEARANCE_KEY)});}catch(e){}
if(p!=="light"&&p!=="dark"&&p!=="auto")p=null;
var k=p==="auto"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;
r.dataset.theme=k?m[s][k]:s;
}catch(e){}})();`;
