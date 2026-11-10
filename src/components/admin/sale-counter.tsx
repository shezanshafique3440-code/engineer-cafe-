"use client";

import { useEffect } from "react";
import { CounterPOS } from "./counter-pos";

/** Keep the familiar online desk; use the prepared public shell on outages. */
export function SaleCounter() {
  useEffect(() => {
    let checking = false;
    let disposed = false;
    let active: AbortController | undefined;
    const offline = () => window.location.assign("/offline-pos.html");
    const check = async () => {
      if (checking || document.hidden) return;
      if (!navigator.onLine) return offline();
      checking = true;
      const controller = new AbortController();
      active = controller;
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        // A public same-origin probe also detects a connected router with no WAN.
        // HTTP errors alone do not mean the internet is disconnected.
        await fetch("/api/settings", {
          cache: "no-store",
          signal: controller.signal,
        });
      } catch {
        if (!disposed) offline();
      } finally {
        clearTimeout(timer);
        checking = false;
      }
    };
    void check();
    window.addEventListener("offline", offline);
    window.addEventListener("focus", check);
    const timer = setInterval(check, 15000);
    return () => {
      disposed = true;
      active?.abort();
      clearInterval(timer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("focus", check);
    };
  }, []);

  return <CounterPOS />;
}
