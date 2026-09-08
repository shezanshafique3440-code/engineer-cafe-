"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicSettings } from "@/server/settings";
import { formatCurrency } from "@/lib/utils";

const SettingsContext = createContext<PublicSettings | null>(null);

export function SettingsProvider({
  settings,
  children,
}: {
  settings: PublicSettings;
  children: ReactNode;
}) {
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useSettings(): PublicSettings {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>.");
  return ctx;
}

/** Currency formatter bound to the symbol configured in admin settings. */
export function useMoney() {
  const settings = useContext(SettingsContext);
  const symbol = settings?.currencySymbol ?? "Rs.";
  return (amount: number) => formatCurrency(amount, symbol);
}
