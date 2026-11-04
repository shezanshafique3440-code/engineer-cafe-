"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Keep the cinematic home palette local; menu/admin theme preferences survive. */
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
