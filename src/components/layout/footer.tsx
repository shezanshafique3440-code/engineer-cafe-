import Link from "next/link";
import { Phone, MessageCircle, MapPin, Clock, Mail, Instagram, Facebook } from "lucide-react";
import { Logo } from "./logo";
import type { PublicSettings } from "@/server/settings";

const QUICK_LINKS = [
  { href: "/menu", label: "Menu" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/account/orders", label: "My Orders" },
  { href: "/cart", label: "Cart" },
];

const CATEGORY_LINKS = [
  { href: "/menu/chai", label: "Chai" },
  { href: "/menu/parathas", label: "Parathas" },
  { href: "/menu/snacks", label: "Snacks" },
  { href: "/menu/combos", label: "Combos" },
  { href: "/menu/cold-drinks", label: "Cold Drinks" },
];

export function Footer({ settings }: { settings: PublicSettings }) {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-charcoal-800 bg-charcoal-900 text-cream-100">
      <div className="container grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="[&_span.text-charcoal-900]:text-cream-50 [&_span.text-charcoal-300]:text-charcoal-300">
            <Logo />
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-charcoal-300">
            {settings.tagline}
          </p>
          <p className="mt-4 font-mono text-xs text-chai-400">
            {"// engineering problems need chai solutions"}
          </p>

          <div className="mt-5 flex gap-2">
            {settings.instagramUrl && (
              <a
                href={settings.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Engineer Cafe on Instagram"
                className="rounded-xl border border-charcoal-700 p-2.5 text-cream-100 transition hover:border-chai-500 hover:text-chai-400"
              >
                <Instagram className="h-4 w-4" />
              </a>
            )}
            {settings.facebookUrl && (
              <a
                href={settings.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Engineer Cafe on Facebook"
                className="rounded-xl border border-charcoal-700 p-2.5 text-cream-100 transition hover:border-chai-500 hover:text-chai-400"
              >
                <Facebook className="h-4 w-4" />
              </a>
            )}
            <a
              href={`https://wa.me/${settings.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Message Engineer Cafe on WhatsApp"
              className="rounded-xl border border-charcoal-700 p-2.5 text-cream-100 transition hover:border-circuit-400 hover:text-circuit-400"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-cream-50">Quick Links</h3>
          <ul className="space-y-2.5">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-charcoal-300 transition hover:text-chai-400">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-cream-50">Categories</h3>
          <ul className="space-y-2.5">
            {CATEGORY_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-sm text-charcoal-300 transition hover:text-chai-400">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-cream-50">Contact</h3>
          <ul className="space-y-3 text-sm text-charcoal-300">
            <li className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-chai-400" aria-hidden />
              <span>{settings.address}</span>
            </li>
            <li className="flex gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-chai-400" aria-hidden />
              <a href={`tel:${settings.phone.replace(/\s/g, "")}`} className="transition hover:text-chai-400">
                {settings.phone}
              </a>
            </li>
            <li className="flex gap-3">
              <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-circuit-400" aria-hidden />
              <a
                href={`https://wa.me/${settings.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="transition hover:text-circuit-400"
              >
                WhatsApp Order
              </a>
            </li>
            <li className="flex gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-chai-400" aria-hidden />
              <a href={`mailto:${settings.email}`} className="transition hover:text-chai-400">
                {settings.email}
              </a>
            </li>
            <li className="flex gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-chai-400" aria-hidden />
              <span>{settings.openingHours}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-charcoal-800">
        <div className="container flex flex-col items-center justify-between gap-3 py-5 sm:flex-row">
          <p className="text-xs text-charcoal-300">
            © {year} {settings.cafeName}. All rights reserved.
          </p>
          <p className="font-mono text-xs text-charcoal-500">
            Built with chai, not coffee.
          </p>
        </div>
      </div>
    </footer>
  );
}
