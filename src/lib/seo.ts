import type { Metadata } from "next";
import { env } from "./env";

export const SITE_NAME = "Engineer Cafe";
export const SITE_DESCRIPTION =
  "Engineer Cafe — premium chai, delicious parathas and student-friendly cafe vibes.";

export function absoluteUrl(path = "/"): string {
  return `${env.siteUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

type SeoInput = {
  title: string;
  description?: string;
  path?: string;
  image?: string | null;
  type?: "website" | "article";
  noIndex?: boolean;
};

export function buildMetadata({
  title,
  description = SITE_DESCRIPTION,
  path = "/",
  image,
  type = "website",
  noIndex = false,
}: SeoInput): Metadata {
  const url = absoluteUrl(path);
  const ogImage = image ?? absoluteUrl("/og-image.svg");

  return {
    title,
    description,
    alternates: { canonical: url },
    ...(noIndex ? { robots: { index: false, follow: false } } : {}),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type,
      locale: "en_PK",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

/** LocalBusiness / Restaurant structured data for the homepage. */
export function restaurantJsonLd(settings: {
  cafeName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  openingHours: string;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: settings.cafeName,
    description: SITE_DESCRIPTION,
    url: absoluteUrl("/"),
    telephone: settings.phone,
    email: settings.email,
    servesCuisine: ["Pakistani", "Tea House", "Cafe"],
    priceRange: "Rs. 60 – Rs. 1500",
    currenciesAccepted: "PKR",
    paymentAccepted: "Cash, Card",
    image: absoluteUrl("/og-image.svg"),
    address: {
      "@type": "PostalAddress",
      streetAddress: settings.address,
      addressLocality: settings.city,
      addressCountry: "PK",
    },
    openingHours: settings.openingHours,
    sameAs: [settings.instagramUrl, settings.facebookUrl].filter(Boolean),
    hasMenu: absoluteUrl("/menu"),
    acceptsReservations: "False",
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
