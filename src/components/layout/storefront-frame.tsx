"use client";

import { useLanguage } from "@/context/language-context";
import { AppTools } from "@/components/pwa/app-tools";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Home layout marker only; colours always inherit the shared root theme. */
export function StorefrontFrame({ children }: { children: ReactNode }) {
  const {locale}=useLanguage();
  const home = usePathname() === "/";
  return (
    <div lang={locale} dir={locale==="ur"?"rtl":"ltr"}
      className={`flex min-h-screen flex-col${home ? " cinema-storefront" : ""}`}
    >
      {children}
      <div className="container pb-28 pt-3 md:pb-5"><AppTools/></div>
    </div>
  );
}
