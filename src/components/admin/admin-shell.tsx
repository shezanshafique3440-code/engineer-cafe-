"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, ShoppingBag, Package, FolderTree, Users, Ticket,
  Star, BarChart3, Settings, Mail, LogOut, Menu, X, ExternalLink,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { useSession } from "@/context/session-context";
import { cn, initials } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/coupons", label: "Coupons", icon: Ticket },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/messages", label: "Messages", icon: Mail },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useSession();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const sidebar = (
    <div className="flex h-full flex-col bg-charcoal-900 text-cream-100">
      <div className="flex h-16 items-center justify-between border-b border-charcoal-800 px-5">
        <div className="[&_span.text-charcoal-900]:text-cream-50 [&_span.bg-charcoal-900]:bg-chai-600 [&_span.text-charcoal-300]:text-charcoal-500">
          <Logo href="/admin" />
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-2 text-charcoal-300 hover:bg-charcoal-800 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
              isActive(item.href)
                ? "bg-chai-600 text-cream-50"
                : "text-charcoal-300 hover:bg-charcoal-800 hover:text-cream-50",
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-charcoal-800 p-3">
        <Link
          href="/"
          className="mb-1 flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-charcoal-300 transition hover:bg-charcoal-800 hover:text-cream-50"
        >
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
          View storefront
        </Link>

        <div className="mt-2 flex items-center gap-3 rounded-xl bg-charcoal-800 p-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-chai-600 text-xs font-bold text-cream-50">
            {user ? initials(user.name) : "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-cream-50">{user?.name}</p>
            <p className="truncate text-[10px] text-charcoal-500">{user?.role}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            aria-label="Logout"
            className="shrink-0 rounded-lg p-2 text-charcoal-300 transition hover:bg-chilli-500/20 hover:text-chilli-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-charcoal-900/50" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute inset-y-0 left-0 w-72" role="dialog" aria-modal="true" aria-label="Admin navigation">
            {sidebar}
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-cream-200 bg-cream-50/95 px-4 backdrop-blur-md lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl p-2 text-charcoal-700 hover:bg-cream-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="font-mono text-xs uppercase tracking-wider text-charcoal-400">
            {"// engineer cafe admin"}
          </p>
        </header>

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
