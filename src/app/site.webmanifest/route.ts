import { getSettings } from "@/server/settings";
import { resolveTheme, THEME_COLOR } from "@/lib/themes";
export const dynamic = "force-dynamic";
export async function GET() {
  const settings = await getSettings();
  const manifest = {
    name: "Engineer Cafe",
    short_name: "Engineer Cafe",
    description:
      "Engineer Cafe — premium chai, delicious parathas and student-friendly cafe vibes.",
    start_url: "/",
    display: "standalone",
    background_color: "#FDFBF7",
    theme_color: "#B9722A",
    icons: [
      {
        src: "/app-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/app-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    id: "/",
    scope: "/",
    shortcuts: [
      {
        name: "Cash counter",
        url: "/admin/pos",
      },
      {
        name: "Menu",
        url: "/menu",
      },
      {
        name: "My orders",
        url: "/account/orders",
      },
    ],
  };
  return Response.json(
    {
      ...manifest,
      name: settings.cafeName,
      short_name: settings.cafeName.slice(0, 24),
      description: settings.tagline,
      theme_color: THEME_COLOR[resolveTheme(settings.theme)],
    },
    {
      headers: {
        "Content-Type": "application/manifest+json",
        "Cache-Control": "public, max-age=60",
      },
    },
  );
}
