"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, Search, ShoppingBag, User, X, LogOut, LayoutDashboard, Heart } from "lucide-react";
import { Logo } from "./logo";
import { useCart } from "@/context/cart-context";
import { useSession } from "@/context/session-context";
import { cn } from "@/lib/utils";
import { SearchDialog } from "@/components/menu/search-dialog";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/menu", label: "Menu" },
  { href: "/menu/chai", label: "Chai" },
  { href: "/menu/parathas", label: "Parathas" },
  { href: "/menu/combos", label: "Combos" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Navbar() {
  const pathname = usePathname();
  const { itemCount } = useCart();
  const { user, logout } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  // Pulse the cart badge whenever the count changes.
  useEffect(() => {
    if (itemCount === 0) return;
    setBump(true);
    const timer = setTimeout(() => setBump(false), 380);
    return () => clearTimeout(timer);
  }, [itemCount]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-charcoal-900 focus:px-4 focus:py-2 focus:text-sm focus:text-cream-50"
      >
        Skip to content
      </a>

      <header
        className={cn(
          "sticky top-0 z-40 w-full transition-all duration-300",
          scrolled
            ? "border-b border-cream-200 bg-cream-50/90 backdrop-blur-md"
            : "border-b border-transparent bg-cream-50",
        )}
      >
        <nav className="container flex h-16 items-center justify-between gap-4 md:h-[72px]" aria-label="Main">
          <div className="flex items-center gap-8">
            <Logo />
            <ul className="hidden items-center gap-1 lg:flex">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={cn(
                      "relative rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive(link.href)
                        ? "text-chai-700"
                        : "text-charcoal-600 hover:bg-cream-100 hover:text-charcoal-900",
                    )}
                  >
                    {link.label}
                    {isActive(link.href) && (
                      <motion.span
                        layoutId="nav-underline"
                        className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-chai-500"
                        transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="rounded-xl p-2.5 text-charcoal-600 transition hover:bg-cream-100 hover:text-charcoal-900"
              aria-label="Search the menu"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>

            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setAccountOpen((v) => !v)}
                className="rounded-xl p-2.5 text-charcoal-600 transition hover:bg-cream-100 hover:text-charcoal-900"
                aria-label="Account menu"
                aria-expanded={accountOpen}
                aria-haspopup="menu"
              >
                <User className="h-[18px] w-[18px]" />
              </button>
              <AnimatePresence>
                {accountOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAccountOpen(false)} aria-hidden />
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-cream-200 bg-white p-1.5 shadow-lift"
                    >
                      {user ? (
                        <>
                          <div className="px-3 py-2">
                            <p className="truncate text-sm font-semibold text-charcoal-900">{user.name}</p>
                            <p className="truncate text-xs text-charcoal-500">{user.email}</p>
                          </div>
                          <hr className="my-1 border-cream-200" />
                          <MenuLink href="/account" icon={<LayoutDashboard className="h-4 w-4" />}>My Account</MenuLink>
                          <MenuLink href="/account/orders" icon={<ShoppingBag className="h-4 w-4" />}>My Orders</MenuLink>
                          <MenuLink href="/account/favorites" icon={<Heart className="h-4 w-4" />}>Favorites</MenuLink>
                          {(user.role === "ADMIN" || user.role === "STAFF") && (
                            <MenuLink href="/admin" icon={<LayoutDashboard className="h-4 w-4" />}>Admin Panel</MenuLink>
                          )}
                          <hr className="my-1 border-cream-200" />
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setAccountOpen(false);
                              void logout();
                            }}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-chilli-600 transition hover:bg-chilli-400/10"
                          >
                            <LogOut className="h-4 w-4" />
                            Logout
                          </button>
                        </>
                      ) : (
                        <>
                          <MenuLink href="/login" icon={<User className="h-4 w-4" />}>Login</MenuLink>
                          <MenuLink href="/register" icon={<User className="h-4 w-4" />}>Create account</MenuLink>
                        </>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <Link
              href="/cart"
              className="relative rounded-xl p-2.5 text-charcoal-600 transition hover:bg-cream-100 hover:text-charcoal-900"
              aria-label={`Cart, ${itemCount} item${itemCount === 1 ? "" : "s"}`}
            >
              <ShoppingBag className="h-[18px] w-[18px]" />
              {itemCount > 0 && (
                <span
                  className={cn(
                    "absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-chai-600 px-1 text-[10px] font-bold text-cream-50",
                    bump && "animate-pop",
                  )}
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </Link>

            <Link href="/menu" className="btn-primary ml-1 hidden md:inline-flex">
              Order Now
            </Link>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-xl p-2.5 text-charcoal-700 transition hover:bg-cream-100 lg:hidden"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="fixed inset-0 z-50 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-charcoal-900/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute right-0 top-0 flex h-full w-[86%] max-w-sm flex-col bg-cream-50 shadow-lift"
            >
              <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
                <Logo />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="rounded-xl p-2 text-charcoal-600 hover:bg-cream-100"
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-4" aria-label="Mobile">
                <ul className="space-y-1">
                  {LINKS.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={cn(
                          "block rounded-xl px-4 py-3 text-base font-medium transition",
                          isActive(link.href)
                            ? "bg-chai-100 text-chai-700"
                            : "text-charcoal-700 hover:bg-cream-100",
                        )}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>

                <hr className="my-4 border-cream-200" />

                <ul className="space-y-1">
                  {user ? (
                    <>
                      <li><Link href="/account" className="block rounded-xl px-4 py-3 text-base font-medium text-charcoal-700 hover:bg-cream-100">My Account</Link></li>
                      <li><Link href="/account/orders" className="block rounded-xl px-4 py-3 text-base font-medium text-charcoal-700 hover:bg-cream-100">My Orders</Link></li>
                      <li><Link href="/account/favorites" className="block rounded-xl px-4 py-3 text-base font-medium text-charcoal-700 hover:bg-cream-100">Favorites</Link></li>
                      {(user.role === "ADMIN" || user.role === "STAFF") && (
                        <li><Link href="/admin" className="block rounded-xl px-4 py-3 text-base font-medium text-charcoal-700 hover:bg-cream-100">Admin Panel</Link></li>
                      )}
                      <li>
                        <button
                          type="button"
                          onClick={() => void logout()}
                          className="w-full rounded-xl px-4 py-3 text-left text-base font-medium text-chilli-600 hover:bg-chilli-400/10"
                        >
                          Logout
                        </button>
                      </li>
                    </>
                  ) : (
                    <>
                      <li><Link href="/login" className="block rounded-xl px-4 py-3 text-base font-medium text-charcoal-700 hover:bg-cream-100">Login</Link></li>
                      <li><Link href="/register" className="block rounded-xl px-4 py-3 text-base font-medium text-charcoal-700 hover:bg-cream-100">Create account</Link></li>
                    </>
                  )}
                </ul>
              </nav>

              <div className="border-t border-cream-200 p-4">
                <Link href="/menu" className="btn-primary w-full">Order Now</Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-charcoal-700 transition hover:bg-cream-100"
    >
      {icon}
      {children}
    </Link>
  );
}
