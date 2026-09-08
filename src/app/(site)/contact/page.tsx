import type { Metadata } from "next";
import { MapPin, Phone, Mail, Clock, MessageCircle, Instagram, Facebook } from "lucide-react";
import { buildMetadata, breadcrumbJsonLd } from "@/lib/seo";
import { getSettings } from "@/server/settings";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = buildMetadata({
  title: "Contact Us",
  description:
    "Reach Engineer Cafe — address, phone, WhatsApp, opening hours and directions. Group bookings and catering welcome.",
  path: "/contact",
});

export const revalidate = 300;

export default async function ContactPage() {
  const settings = await getSettings();
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(settings.mapsQuery)}&output=embed`;
  const whatsappHref = `https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(
    `Hi ${settings.cafeName}, I want to place an order.`,
  )}`;

  const details = [
    { icon: MapPin, label: "Address", value: settings.address, href: `https://www.google.com/maps/search/${encodeURIComponent(settings.mapsQuery)}`, external: true },
    { icon: Phone, label: "Phone", value: settings.phone, href: `tel:${settings.phone.replace(/\s/g, "")}` },
    { icon: MessageCircle, label: "WhatsApp", value: `+${settings.whatsapp}`, href: whatsappHref, external: true },
    { icon: Mail, label: "Email", value: settings.email, href: `mailto:${settings.email}` },
    { icon: Clock, label: "Opening hours", value: settings.openingHours },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: "Contact", path: "/contact" },
            ]),
          ),
        }}
      />

      <div className="border-b border-cream-200 bg-cream-100">
        <div className="container py-12 md:py-16">
          <p className="eyebrow">{"// get in touch"}</p>
          <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">Talk to us.</h1>
          <p className="mt-3 max-w-2xl text-sm text-charcoal-600 md:text-base">
            Orders, group bookings, catering for a hackathon, or feedback on a chai that
            wasn&apos;t right — all of it reaches the same team.
          </p>
        </div>
      </div>

      <div className="container grid gap-8 py-10 md:py-14 lg:grid-cols-[380px_1fr] lg:gap-10">
        <div className="space-y-3">
          {details.map((detail) => (
            <div key={detail.label} className="surface flex gap-3.5 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chai-100 text-chai-600">
                <detail.icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-400">
                  {detail.label}
                </p>
                {detail.href ? (
                  <a
                    href={detail.href}
                    target={detail.external ? "_blank" : undefined}
                    rel={detail.external ? "noopener noreferrer" : undefined}
                    className="mt-0.5 block break-words text-sm font-medium text-charcoal-800 transition hover:text-chai-700"
                  >
                    {detail.value}
                  </a>
                ) : (
                  <p className="mt-0.5 text-sm font-medium text-charcoal-800">{detail.value}</p>
                )}
              </div>
            </div>
          ))}

          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn w-full bg-[#25D366] py-3.5 text-white hover:brightness-105"
          >
            <MessageCircle className="h-4 w-4" aria-hidden /> Order on WhatsApp
          </a>

          {(settings.instagramUrl || settings.facebookUrl) && (
            <div className="surface p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-charcoal-400">
                Follow us
              </p>
              <div className="flex gap-2">
                {settings.instagramUrl && (
                  <a
                    href={settings.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cream-200 py-2.5 text-sm font-medium text-charcoal-700 transition hover:border-chai-400 hover:text-chai-700"
                  >
                    <Instagram className="h-4 w-4" aria-hidden /> Instagram
                  </a>
                )}
                {settings.facebookUrl && (
                  <a
                    href={settings.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-cream-200 py-2.5 text-sm font-medium text-charcoal-700 transition hover:border-chai-400 hover:text-chai-700"
                  >
                    <Facebook className="h-4 w-4" aria-hidden /> Facebook
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <ContactForm />

          <div className="overflow-hidden rounded-2xl border border-cream-200 bg-cream-200">
            <iframe
              src={mapSrc}
              title={`Map showing ${settings.cafeName} in ${settings.city}`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-[340px] w-full border-0"
            />
          </div>
        </div>
      </div>
    </>
  );
}
