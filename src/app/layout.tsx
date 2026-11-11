import { LanguageProvider } from "@/context/language-context";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import "./globals.css";
import "./cinematic.css";
import "./hero-performance.css";
import "./dish-experience.css";
import "./theme-presets.css";
import { env } from "@/lib/env";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import { getSettings } from "@/server/settings";
import { resolveTheme, THEME_COLOR, isDarkTheme, APPEARANCE_SCRIPT } from "@/lib/themes";
import { ThemeAppearanceProvider } from "@/context/theme-appearance-context";

const inter = localFont({
  src: "./fonts/inter.woff2",
  weight: "100 900",
  variable: "--font-sans",
  display: "swap",
});

const display = localFont({
  src: "./fonts/bricolage-grotesque.woff2",
  variable: "--font-display",
  display: "swap",
  weight: "400 800",
});

const mono = localFont({
  src: "./fonts/jetbrains-mono.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "100 800",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const name = settings.cafeName || SITE_NAME;
  return {
  metadataBase: new URL(env.siteUrl),
  title: {
    default: `${name} | Chai & Paratha`,
    template: `%s | ${name}`,
  },
  description: settings.tagline || SITE_DESCRIPTION,
  applicationName: name,
  keywords: [
    "Engineer Cafe", "chai Islamabad", "paratha delivery", "karak chai",
    "student cafe Pakistan", "tea house", "Chatta Bakhtawar", "chai paratha",
  ],
  authors: [{ name }],
  creator: name,
  formatDetection: { telephone: true, address: false, email: false },
  icons: { icon: "/favicon.svg", apple: "/app-icon/192" },
  manifest: "/site.webmanifest",
  robots: { index: true, follow: true },
  };
}

export async function generateViewport(): Promise<Viewport> {
  // The browser chrome should match whichever palette the cafe picked.
  const settings = await getSettings();
  return {
    themeColor: THEME_COLOR[resolveTheme(settings.theme)],
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    viewportFit: "cover",
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
        <ThemeAppearanceProvider siteTheme={theme}>
          <LanguageProvider>{children}</LanguageProvider>
          <Toaster
            position="bottom-right"
            mobileOffset={{ bottom: "calc(6rem + env(safe-area-inset-bottom))", left: 16, right: 16 }}
            richColors
            closeButton
            toastOptions={{ className: "font-sans text-sm" }}
          />
        </ThemeAppearanceProvider>
      </body>
    </html>
  );
}
