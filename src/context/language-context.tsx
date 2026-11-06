"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { URDU } from "@/lib/urdu";
type Locale = "en" | "ur";
const Context = createContext<{
  locale: Locale;
  t: (text: string) => string;
  setLocale: (value: Locale) => void;
}>({ locale: "en", t: (s) => s, setLocale: () => undefined });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const path = usePathname();
  useEffect(() => {
    try {
      setLocaleState(
        localStorage.getItem("ec-language") === "ur" ? "ur" : "en",
      );
    } catch {
      /* Session preference still works. */
    }
    const handler = (e: StorageEvent) => {
      if (e.key === "ec-language")
        setLocaleState(e.newValue === "ur" ? "ur" : "en");
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  const setLocale = (value: Locale) => {
    setLocaleState(value);
    try {
      localStorage.setItem("ec-language", value);
    } catch {
      /* Session preference still works. */
    }
  };
  const active = path.startsWith("/admin") ? "en" : locale;
  useEffect(() => {
    document.documentElement.lang = active;
    document.documentElement.dir = active === "ur" ? "rtl" : "ltr";
  }, [active]);
  return (
    <Context.Provider
      value={{
        locale: active,
        setLocale,
        t: (s) => (active === "ur" ? (URDU[s.trim()] ?? s) : s),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useLanguage() {
  return useContext(Context);
}
export function T({ text, urdu }: { text: string; urdu?: string | null }) {
  const { t, locale } = useLanguage();
  return <>{locale === "ur" && urdu ? urdu : t(text)} </>;
}
export function LanguageSwitch() {
  const { locale, setLocale } = useLanguage();
  return (
    <button
      type="button"
      className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl px-0 text-sm sm:w-auto sm:px-3 font-semibold"
      onClick={() => setLocale(locale === "en" ? "ur" : "en")}
      aria-label={
        locale === "en" ? "اردو زبان منتخب کریں" : "Switch to English"
      }
    >
      {locale === "en" ? (
        "اردو"
      ) : (
        <>
          <span className="sm:hidden">EN</span>
          <span className="hidden sm:inline">English</span>
        </>
      )}
    </button>
  );
}
