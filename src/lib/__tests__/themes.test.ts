import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import {
  APPEARANCE_SCRIPT,
  DEFAULT_THEME,
  THEMES,
  THEME_IDS,
  THEME_MODES,
  VARIANT_COLOR,
  appearanceTheme,
  resolveAppearance,
  resolveTheme,
} from "../themes";
import { settingsSchema } from "../validation";

function firstPaint(
  site: string,
  stored: string | null,
  dark = false,
  blocked = false,
) {
  const dataset = {
    siteTheme: site,
    theme: site,
    siteDark: site === "midnight" || site === "espresso" ? "1" : "0",
  };
  let writes = 0;
  runInNewContext(APPEARANCE_SCRIPT, {
    document: { documentElement: { dataset } },
    localStorage: {
      getItem: () => {
        if (blocked) throw new Error("Storage blocked");
        return stored;
      },
      setItem: () => {
        writes += 1;
      },
    },
    matchMedia: () => ({ matches: dark }),
  });
  assert.equal(writes, 0, "Reading mode must not rewrite saved preferences");
  return dataset.theme;
}

test("the admin catalog has ten valid presets and rejects private mode ids", () => {
  assert.equal(THEMES.length, 10);
  assert.equal(new Set(THEME_IDS).size, 10);
  for (const id of THEME_IDS)
    assert.equal(settingsSchema.shape.theme.safeParse(id).success, true);
  for (const id of ["ocean-dark", "espresso-light", "blue", "__proto__", ""]) {
    assert.equal(settingsSchema.shape.theme.safeParse(id).success, false, id);
    assert.equal(resolveTheme(id), DEFAULT_THEME);
  }
});

test("fresh visitors see the exact admin choice, including dark cafe defaults", () => {
  for (const theme of THEMES) {
    for (const osDark of [false, true]) {
      assert.equal(appearanceTheme(theme.id, null, osDark), theme.id);
      assert.equal(firstPaint(theme.id, null, osDark), theme.id);
    }
  }
});

test("personal modes keep the selected brand family instead of replacing it with Midnight", () => {
  assert.equal(appearanceTheme("ocean", "dark"), "ocean-dark");
  assert.equal(appearanceTheme("matcha", "dark"), "matcha-dark");
  assert.equal(appearanceTheme("royal", "light"), "royal");
  assert.equal(appearanceTheme("espresso", "light"), "espresso-light");
  assert.equal(appearanceTheme("midnight", "light"), "chai");
  assert.equal(appearanceTheme("gulabi", "auto", true), "gulabi-dark");
  assert.equal(appearanceTheme("gulabi", "auto", false), "gulabi");
});

test("blocking first paint and hydrated appearance agree for every preset and preference", () => {
  for (const theme of THEMES) {
    for (const stored of [
      null,
      "light",
      "dark",
      "auto",
      "ocean",
      "constructor",
      "",
    ]) {
      for (const osDark of [false, true]) {
        assert.equal(
          firstPaint(theme.id, stored, osDark),
          appearanceTheme(theme.id, resolveAppearance(stored), osDark),
          `${theme.id}/${stored}/${osDark}`,
        );
      }
    }
  }
});

test("blocked storage and forged preferences preserve the cafe's own palette", () => {
  assert.equal(firstPaint("espresso", "light", true, true), "espresso");
  assert.equal(firstPaint("ocean", "royal"), "ocean");
  assert.equal(firstPaint("__proto__", "dark"), "midnight");
  assert.equal(firstPaint("constructor", null), "chai");
  assert.equal(resolveAppearance("royal-dark"), null);
});

test("every selectable theme and paired reading mode has shipped CSS and browser chrome colour", () => {
  const css = ["src/app/globals.css", "src/app/theme-presets.css"]
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  for (const theme of THEMES) {
    for (const variant of [
      theme.id,
      THEME_MODES[theme.id].light,
      THEME_MODES[theme.id].dark,
    ]) {
      assert.ok(
        css.includes(`[data-theme="${variant}"]`),
        `Missing palette CSS: ${variant}`,
      );
      assert.match(VARIANT_COLOR[variant], /^#[a-f0-9]{6}$/i);
    }
  }
});
