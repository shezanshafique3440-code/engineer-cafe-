import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { env } from "@/lib/env";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { getSettings } from "@/server/settings";
import { resolveTheme, THEME_COLOR, isDarkTheme, APPEARANCE_SCRIPT } from "@/lib/themes";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${SITE_NAME} | Chai & Paratha`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Engineer Cafe", "chai Islamabad", "paratha delivery", "karak chai",
    "student cafe Pakistan", "tea house", "Chatta Bakhtawar", "chai paratha",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  formatDetection: { telephone: true, address: false, email: false },
  icons: { icon: "/favicon.svg", apple: "/favicon.svg" },
  manifest: "/site.webmanifest",
  robots: { index: true, follow: true },
};

export async function generateViewport(): Promise<Viewport> {
  // The browser chrome should match whichever palette the cafe picked.
  const settings = await getSettings();
  return {
    themeColor: THEME_COLOR[resolveTheme(settings.theme)],
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Rendering the theme onto <html> on the server means the very first paint
  // is already in the right palette — no flash of the default one, and no
  // blocking inline script to prevent it.
  const settings = await getSettings();
  const theme = resolveTheme(settings.theme);
  const siteIsDark = isDarkTheme(theme);

  return (
    <html
      lang="en"
      // The inline script below rewrites data-theme before React loads, which
      // is the whole point — so React must not treat that as a mismatch.
      suppressHydrationWarning
      data-theme={theme}
      // The cafe's own choice, kept so the script can restore it when the
      // visitor switches back to light.
      data-site-theme={theme}
      data-site-dark={siteIsDark ? "1" : "0"}
      className={`${inter.variable} ${display.variable} ${mono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_SCRIPT }} />
      </head>
      <body>
        {children}
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{ className: "font-sans text-sm" }}
        />
      </body>
    </html>
  );
}
