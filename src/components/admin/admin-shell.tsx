"use client";

import { canBusiness } from "@/lib/business-access";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CAFE_TASKS } from "@/lib/cafe-tasks";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  FolderTree,
  Users,
  Ticket,
  Star,
  BarChart3,
  Settings,
  Mail,
  LogOut,
  Menu,
  X,
  ExternalLink,
  Search,
  WifiOff,
  ChefHat,
  Sparkles,
  QrCode,
} from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { useSession } from "@/context/session-context";
import { useSettings } from "@/context/settings-context";
import { NewOrderAlert } from "./new-order-alert";
import { useDialogFocus } from "@/hooks/use-dialog-focus";
import { cn, initials } from "@/lib/utils";

const EXTRA_NAV = [
  { href: "/admin/business", label: "Cafe business system", icon: BarChart3 },
  {
    href: "/admin/table-orders",
    label: "Waiter order desk",
    icon: ShoppingBag,
  },
  { href: "/admin/pos", label: "Counter POS", icon: ShoppingBag },
  { href: "/admin/experience", label: "Rewards & scheduling", icon: Sparkles },
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/kitchen", label: "Kitchen live", icon: ChefHat },
  { href: "/admin/insights", label: "Business insights", icon: Sparkles },
  { href: "/admin/qr-studio", label: "QR menu studio", icon: QrCode },
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
  const searchParams = useSearchParams();
  const [advanced, setAdvanced] = useState(false);
  const [query, setQuery] = useState("");
  const { user, logout } = useSession();
  const settings = useSettings();
  const capFor = (href: string) =>
    ({
      "/admin": "orders",
      "/admin/business": "business",
      "/admin/pos": "pos",
      "/admin/table-orders": "table-orders",
      "/admin/experience": "admin",
      "/admin/kitchen": "kitchen",
      "/admin/insights": "insights",
      "/admin/qr-studio": "catalog",
      "/admin/orders": "orders",
      "/admin/products": "catalog",
      "/admin/categories": "catalog",
      "/admin/customers": "customers",
      "/admin/coupons": "catalog",
      "/admin/reviews": "catalog",
      "/admin/messages": "customers",
      "/admin/analytics": "insights",
      "/admin/settings": "settings",
    })[href] ?? "admin";
  const mainNav = [
    { href: "/admin", label: "Roz ka kaam / Home", icon: LayoutDashboard },
    ...CAFE_TASKS.filter((task) => canBusiness(user, task.cap))
      .filter((task) =>
        [
          "pos",
          "tables",
          "kitchen",
          "orders",
          "delivery",
          "cash",
          "inventory",
          "purchases",
          "attendance",
          "staff",
          "overview",
        ].includes(task.id),
      )
      .map((task) => ({
        href: task.href,
        label: task.label,
        icon:
          task.id === "kitchen"
            ? ChefHat
            : task.id === "overview"
              ? BarChart3
              : task.id === "staff" || task.id === "attendance"
                ? Users
                : task.id === "inventory" || task.id === "purchases"
                  ? Package
                  : ShoppingBag,
      })),
  ];
  const extraNav = EXTRA_NAV.filter((item) =>
    capFor(item.href) === "business"
      ? Boolean(user && user.role !== "CUSTOMER")
      : canBusiness(user, capFor(item.href)),
  ).filter(
    (item) =>
      !["/admin", "/admin/pos", "/admin/kitchen", "/admin/orders"].includes(
        item.href,
      ),
  );
  const visibleNav = [
    ...mainNav,
    ...(advanced || query.trim() ? extraNav : []),
  ];

  const quickPaths =
    user?.businessProfile === "CHEF"
      ? ["/admin/kitchen", "/admin/orders"]
      : user?.businessProfile === "WAITER"
        ? ["/admin/business?section=tables", "/admin/kitchen"]
        : ["/admin/pos", "/admin/business?section=tables"];
  const quickNav = mainNav.filter(
    (item) => item.href === "/admin" || quickPaths.includes(item.href),
  );
  const quickLabel = (href: string) =>
    ({
      "/admin": "Home",
      "/admin/pos": "Naya bill",
      "/admin/business?section=tables": "Tables",
      "/admin/kitchen": "Kitchen",
      "/admin/orders": "Orders",
    })[href] ?? "Open";

  const [open, setOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const drawer = useRef<HTMLDivElement>(null);
  useDialogFocus(open, drawer, () => setOpen(false));
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    const media = window.matchMedia("(min-width: 1024px)");
    const resize = () => {
      if (media.matches) setOpen(false);
    };
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    media.addEventListener("change", resize);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      media.removeEventListener("change", resize);
    };
  }, []);

  const isActive = (href: string) => {
    const [path, query] = href.split("?");
    if (path === "/admin") return pathname === path;
    if (query)
      return (
        pathname === path &&
        searchParams.get("section") ===
          new URLSearchParams(query).get("section")
      );
    return (
      pathname === path &&
      !(path === "/admin/business" && searchParams.has("section"))
    );
  };

  const sidebar = (
    <div className="admin-sidebar flex h-full flex-col bg-charcoal-900 text-cream-100">
      <div className="flex h-16 items-center justify-between border-b border-charcoal-800 px-5">
        <Logo href="/admin" src={settings.logoUrl} onDark />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg p-2 text-charcoal-300 hover:bg-charcoal-800 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative mx-3 mt-4">
        <Search
          className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-charcoal-300"
          aria-hidden
        />
        <input
          type="search"
          aria-label="Find an admin page"
          placeholder="Kaam dhoondein…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-charcoal-700 bg-charcoal-800 py-2 pl-10 pr-3 text-base text-cream-50 placeholder:text-charcoal-300"
        />
      </div>
      <button
        type="button"
        aria-expanded={advanced}
        onClick={() => setAdvanced((v) => !v)}
        className="mx-3 mt-3 min-h-11 rounded-xl border border-charcoal-700 px-3 text-left text-sm text-cream-100"
      >
        {advanced
          ? "− Extra tools band karein"
          : "+ Extra tools / Website settings"}
      </button>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Admin">
        {visibleNav
          .filter((item) =>
            item.label.toLowerCase().includes(query.trim().toLowerCase()),
          )
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 min-h-11 rounded-xl px-3.5 py-2.5 text-sm font-medium transition",
                isActive(item.href)
                  ? "bg-chai-600 text-cream-50"
                  : "text-charcoal-300 hover:bg-charcoal-800 hover:text-cream-50",
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          ))}
        {!visibleNav.some((item) =>
          item.label.toLowerCase().includes(query.trim().toLowerCase()),
        ) && (
          <p className="p-3 text-sm text-charcoal-300">
            No matching page. Try Orders or Products.
          </p>
        )}
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
            <p className="truncate text-xs font-bold text-cream-50">
              {user?.name}
            </p>
            <p className="truncate text-[10px] text-charcoal-500">
              {user?.role}
            </p>
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
    <div className="admin-workspace min-h-dvh bg-cream-100">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-charcoal-900/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={drawer}
            tabIndex={-1}
            id="admin-mobile-menu"
            className="absolute inset-y-0 left-0 w-[min(20rem,calc(100vw-2rem))] pb-[env(safe-area-inset-bottom)]"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
          >
            {sidebar}
          </div>
        </div>
      )}

      <div className="min-w-0 lg:pl-64">
        <header className="cafe-brand-header sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-cream-200 bg-cream-50/95 px-4 backdrop-blur-md lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-charcoal-700 hover:bg-cream-100 lg:hidden"
            aria-expanded={open}
            aria-controls={open ? "admin-mobile-menu" : undefined}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-charcoal-900">
              {visibleNav.find((item) => isActive(item.href))?.label ?? "Admin"}
            </p>
            <p className="truncate text-xs text-charcoal-500">
              {settings.cafeName}
            </p>
          </div>
          <Link
            href="/"
            className="ml-auto hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-chai-700 sm:inline-flex"
          >
            <ExternalLink className="h-4 w-4" aria-hidden /> View cafe
          </Link>
          <div className="ml-auto shrink-0 sm:ml-0">
            <NewOrderAlert />
          </div>
        </header>

        {offline && (
          <div
            role="status"
            className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              Internet band hai.{" "}
              {canBusiness(user, "pos") ? (
                <a href="/offline-pos.html" className="font-bold underline">
                  Offline cash counter kholein.
                </a>
              ) : (
                "Changes save karne ke liye reconnect karein."
              )}
            </span>
          </div>
        )}
        <main
          id="admin-main"
          className="min-w-0 p-3 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:p-5 lg:p-8"
        >
          {children}
        </main>
      </div>
      <nav
        aria-label="Admin quick navigation"
        style={{
          gridTemplateColumns: `repeat(${quickNav.length + 1}, minmax(0, 1fr))`,
        }}
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-cream-200 bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        {quickNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold",
              isActive(item.href) ? "text-chai-700" : "text-charcoal-500",
            )}
          >
            <item.icon className="h-5 w-5" aria-hidden />
            {quickLabel(item.href)}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls={open ? "admin-mobile-menu" : undefined}
          className="flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold text-charcoal-500"
        >
          <Menu className="h-5 w-5" aria-hidden />
          Menu
        </button>
      </nav>
    </div>
  );
}
