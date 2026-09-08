"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/cart-context";
import { useSettings, useMoney } from "@/context/settings-context";

/**
 * Floating WhatsApp order button. When the cart has items it builds a
 * ready-to-send order message; otherwise it opens a simple enquiry.
 */
export function WhatsAppButton() {
  const settings = useSettings();
  const { lines, quote, localSubtotal } = useCart();
  const money = useMoney();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(timer);
  }, []);

  const total = quote?.total ?? localSubtotal;

  const message =
    lines.length === 0
      ? `Hi ${settings.cafeName}, I want to place an order.`
      : [
          `Hi ${settings.cafeName}, I'd like to order:`,
          "",
          ...lines.map((line, index) => {
            const addons = line.addons.length
              ? `\n   Options: ${line.addons.map((a) => a.name).join(", ")}`
              : "";
            const note = line.notes ? `\n   Note: ${line.notes}` : "";
            return `${index + 1}. ${line.name} × ${line.quantity}${addons}${note}`;
          }),
          "",
          `Total: ${money(total)}`,
        ].join("\n");

  const href = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(message)}`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.7, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ type: "spring", stiffness: 340, damping: 22 }}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          aria-label={
            lines.length
              ? `Order ${lines.length} item${lines.length === 1 ? "" : "s"} on WhatsApp`
              : "Order on WhatsApp"
          }
          className="group fixed bottom-[88px] right-4 z-30 flex h-13 items-center gap-2 rounded-full bg-[#25D366] px-4 py-3.5 text-white shadow-lift md:bottom-6 md:right-6"
        >
          <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
          <span className="hidden text-sm font-semibold sm:inline">
            {lines.length ? `Order ${lines.length} item${lines.length === 1 ? "" : "s"}` : "WhatsApp Order"}
          </span>
        </motion.a>
      )}
    </AnimatePresence>
  );
}
