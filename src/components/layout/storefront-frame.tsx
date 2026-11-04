"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Home layout marker only; colours always inherit the shared root theme. */
export function StorefrontFrame({ children }: { children: ReactNode }) {
  const home = usePathname() === "/";
  return (
    <div
      className={`flex min-h-screen flex-col${home ? " cinema-storefront" : ""}`}
    >
      {children}
    </div>
  );
}
