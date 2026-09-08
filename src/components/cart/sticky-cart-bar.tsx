"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useMoney } from "@/context/settings-context";

const HIDDEN_ON = ["/cart", "/checkout"];

/** "3 items • Rs. 850 → View Cart" bar that follows you around on mobile. */
export function StickyCartBar() {
  const { itemCount, localSubtotal, quote } = useCart();
  const pathname = usePathname();
  const money = useMoney();

  const hidden =
    itemCount === 0 || HIDDEN_ON.some((p) => pathname === p) || pathname.startsWith("/admin");

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          className="fixed inset-x-3 bottom-[70px] z-30 md:hidden"
        >
          <Link
            href="/cart"
            className="flex items-center justify-between gap-3 rounded-2xl bg-charcoal-900 px-4 py-3.5 text-cream-50 shadow-lift"
          >
            <span className="flex items-center gap-2.5">
              <ShoppingBag className="h-[18px] w-[18px]" aria-hidden />
              <span className="text-sm font-semibold">
                {itemCount} item{itemCount === 1 ? "" : "s"}
                <span className="mx-1.5 text-charcoal-500">•</span>
                {money(quote?.total ?? localSubtotal)}
              </span>
            </span>
            <span className="rounded-lg bg-chai-500 px-3 py-1.5 text-xs font-bold">View Cart</span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
