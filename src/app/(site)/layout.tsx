import { BackToTop } from "@/components/layout/back-to-top";
import { StorefrontProvider } from "@/context/storefront-context";
import { ComparisonDock } from "@/components/storefront/compare-controls";
import { ServiceRibbon } from "@/components/storefront/order-guidance";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { WhatsAppButton } from "@/components/layout/whatsapp-button";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ScrollReveal } from "@/components/layout/scroll-reveal";
import { StickyCartBar } from "@/components/cart/sticky-cart-bar";
import { SessionProvider } from "@/context/session-context";
import { SettingsProvider } from "@/context/settings-context";
import { CartProvider } from "@/context/cart-context";
import { FavoritesProvider } from "@/context/favorites-context";
import { getSettings, publicSettings } from "@/server/settings";
import { getCurrentUser } from "@/server/auth";

export default async function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [settingsRow, user] = await Promise.all([
    getSettings(),
    getCurrentUser(),
  ]);
  const settings = publicSettings(settingsRow);

  return (
    <SettingsProvider settings={settings}>
      <SessionProvider initialUser={user}>
        <FavoritesProvider>
          <CartProvider>
            <StorefrontProvider>
              <div className="flex min-h-screen flex-col">
                <Navbar />
                <ServiceRibbon />
                <ComparisonDock />
                <main id="main" className="flex-1 pb-24 md:pb-0">
                  {children}
                </main>
                <Footer settings={settings} />
                <WhatsAppButton />
                <StickyCartBar />
                <BottomNav />
                <ScrollReveal />
                <BackToTop />
              </div>
            </StorefrontProvider>
          </CartProvider>
        </FavoritesProvider>
      </SessionProvider>
    </SettingsProvider>
  );
}
