"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, ShoppingBag, Heart, MapPin, Settings, LogOut } from "lucide-react";
import { useSession } from "@/context/session-context";
import { cn, initials } from "@/lib/utils";

const NAV = [
  { href: "/account", label: "Overview", icon: User },
  { href: "/account/orders", label: "My Orders", icon: ShoppingBag },
  { href: "/account/favorites", label: "Favorites", icon: Heart },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/settings", label: "Settings", icon: Settings },
];

export function AccountShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useSession();

  return (
    <div className="container py-8 md:py-12">
      <div className="grid gap-6 lg:grid-cols-[260px_1fr] lg:gap-10">
        <aside>
          <div className="surface p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-chai-600 font-display text-base font-bold text-cream-50">
                {user ? initials(user.name) : "?"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-charcoal-900">{user?.name}</p>
                <p className="truncate text-xs text-charcoal-500">{user?.email}</p>
              </div>
            </div>
          </div>

          <nav className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto lg:mt-4 lg:flex-col lg:overflow-visible" aria-label="Account">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium transition",
                    active
                      ? "bg-chai-600 text-cream-50"
                      : "bg-white text-charcoal-600 hover:bg-cream-100 lg:bg-transparent",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => void logout()}
              className="flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-sm font-medium text-chilli-600 transition hover:bg-chilli-400/10"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />
              Logout
            </button>
          </nav>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
