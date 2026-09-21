"use client";

import { useEffect } from "react";

/**
 * Drives every `.reveal` on the page from one IntersectionObserver.
 *
 * Mounted once in the storefront layout. A per-element motion component would
 * mean one observer and one React subscription per heading; this is one
 * observer for the lot, and the elements themselves stay server-rendered.
 *
 * It marks <html> with `data-reveal-ready` before hiding anything, so if this
 * never runs — a JS failure, an old browser — the content is simply visible
 * rather than stuck invisible.
 */
export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;
    if (!("IntersectionObserver" in window)) return;

    root.setAttribute("data-reveal-ready", "");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          // One-way: a heading that has arrived should not fade out again.
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );

    const observe = () => {
      document
        .querySelectorAll(".reveal:not([data-revealed])")
        .forEach((el) => observer.observe(el));
    };
    observe();

    // Client-side navigation swaps the tree without remounting this, and
    // filtering the menu adds new cards, so watch for both.
    const mutations = new MutationObserver(observe);
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
      root.removeAttribute("data-reveal-ready");
    };
  }, []);

  return null;
}
