"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  APPEARANCE_KEY,
  VARIANT_COLOR,
  appearanceTheme,
  isDarkTheme,
  resolveAppearance,
  resolveTheme,
  type Appearance,
  type ThemeId,
  type ThemeVariant,
} from "@/lib/themes";

type ThemeAppearance = {
  siteTheme: ThemeId;
  preference: Appearance | null;
  effectiveTheme: ThemeVariant;
  ready: boolean;
  setAppearance: (value: Appearance) => void;
  previewTheme: (value: string) => void;
  clearPreview: () => void;
  commitTheme: (value: string) => void;
};

const Context = createContext<ThemeAppearance | null>(null);

/** The cafe owns its palette; a visitor owns only their local reading mode. */
export function ThemeAppearanceProvider({
  siteTheme: savedTheme,
  children,
}: {
  siteTheme: ThemeId;
  children: ReactNode;
}) {
  const [siteTheme, setSiteTheme] = useState(savedTheme);
  const [preference, setPreference] = useState<Appearance | null>(null);
  const [systemDark, setSystemDark] = useState(false);
  const [preview, setPreview] = useState<ThemeId | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSiteTheme(savedTheme);
  }, [savedTheme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    try {
      setPreference(
        resolveAppearance(window.localStorage.getItem(APPEARANCE_KEY)),
      );
    } catch {
      /* Use the cafe default. */
    }
    setSystemDark(media.matches);
    setReady(true);
    const onMedia = () => setSystemDark(media.matches);
    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY || event.key === null)
        setPreference(resolveAppearance(event.newValue));
    };
    media.addEventListener("change", onMedia);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onMedia);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const effectiveTheme =
    preview ?? appearanceTheme(siteTheme, preference, systemDark);
  useEffect(() => {
    // The blocking head script already applied any stored preference. Do not
    // briefly replace it with defaults while localStorage is being read.
    if (!ready) return;
    const root = document.documentElement;
    root.dataset.siteTheme = siteTheme;
    root.dataset.siteDark = isDarkTheme(siteTheme) ? "1" : "0";
    root.dataset.theme = effectiveTheme;
    const colour = VARIANT_COLOR[effectiveTheme];
    const syncChrome = () => {
      document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        if (meta.getAttribute("content") !== colour)
          meta.setAttribute("content", colour);
      });
    };
    syncChrome();
    // Next replaces viewport metadata during client-side navigation. Keep
    // the browser chrome on the visitor's effective mode after that update.
    const observer = new MutationObserver(syncChrome);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["name", "content"],
    });
    return () => observer.disconnect();
  }, [siteTheme, effectiveTheme, ready]);

  const setAppearance = useCallback((value: Appearance) => {
    setPreference(value);
    try {
      window.localStorage.setItem(APPEARANCE_KEY, value);
    } catch {
      /* Still apply for this visit. */
    }
  }, []);
  const previewTheme = useCallback(
    (value: string) => setPreview(resolveTheme(value)),
    [],
  );
  const clearPreview = useCallback(() => setPreview(null), []);
  const commitTheme = useCallback(
    (value: string) => setSiteTheme(resolveTheme(value)),
    [],
  );
  const value = useMemo(
    () => ({
      siteTheme,
      preference,
      effectiveTheme,
      ready,
      setAppearance,
      previewTheme,
      clearPreview,
      commitTheme,
    }),
    [
      siteTheme,
      preference,
      effectiveTheme,
      ready,
      setAppearance,
      previewTheme,
      clearPreview,
      commitTheme,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useThemeAppearance() {
  const context = useContext(Context);
  if (!context)
    throw new Error("Theme appearance must be used inside its provider.");
  return context;
}
