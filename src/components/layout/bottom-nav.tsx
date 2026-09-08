"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Home, UtensilsCrossed, Search, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/context/cart-context";
import { SearchDialog } from "@/components/menu/search-dialog";

/** Mobile-only bottom navigation — one tap to every ordering surface. */
export function BottomNav() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const items = [
    { href: "/", label: "Home", icon: Home },
    { href: "/menu", label: "Menu", icon: UtensilsCrossed },
    { href: null, label: "Search", icon: Search },
    { href: "/cart", label: "Cart", icon: ShoppingBag, badge: itemCount },
    { href: "/account", label: "Account", icon: User },
  ] as const;

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-cream-200 bg-cream-50/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        aria-label="Mobile navigation"
      >
        <ul className="grid grid-cols-5">
          {items.map((item) => {
            const Icon = item.icon;
            const active = item.href ? isActive(item.href) : false;
            const content = (
              <>
                <span className="relative">
                  <Icon className="h-[19px] w-[19px]" aria-hidden />
                  {"badge" in item && item.badge > 0 && (
                    <span className="absolute -right-2 -top-1.5 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-chai-600 px-1 text-[9px] font-bold text-cream-50">
                      {item.badge > 9 ? "9+" : item.badge}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium">{item.label}</span>
              </>
            );

            return (
              <li key={item.label}>
                {item.href ? (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2.5 transition-colors",
                      active ? "text-chai-600" : "text-charcoal-500",
                    )}
                  >
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSearchOpen(true)}
                    className="flex w-full flex-col items-center gap-1 py-2.5 text-charcoal-500 transition-colors"
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
