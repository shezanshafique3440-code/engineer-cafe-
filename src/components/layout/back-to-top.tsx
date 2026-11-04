"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const update = () => setVisible(window.scrollY > 800);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  if (!visible) return null;
  return <button type="button" aria-label="Back to top"
    onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })}
    className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] left-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-cream-300 bg-surface text-chai-700 shadow-lift transition hover:bg-cream-100 md:bottom-6">
    <ArrowUp className="h-5 w-5" aria-hidden />
  </button>;
}
