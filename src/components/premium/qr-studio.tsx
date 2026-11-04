"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Copy, Download, Printer, QrCode } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { menuQrUrl, escapeMarkup } from "@/lib/qr-menu";
import { useSettings } from "@/context/settings-context";
import { PageHeader } from "@/components/admin/ui";
import { Button, Input, Select } from "@/components/ui";
import type { CategoryDTO } from "@/lib/types";
export function QrStudio() {
  const settings = useSettings();
  const [categories, setCategories] = useState<CategoryDTO[]>([]),
    [destination, setDestination] = useState("/menu"),
    [campaign, setCampaign] = useState(""),
    [headline, setHeadline] = useState("Good food. One scan away."),
    [image, setImage] = useState(""),
    [url, setUrl] = useState(""),
    [failed, setFailed] = useState(false),
    [categoryFailed, setCategoryFailed] = useState(false);
  useEffect(() => {
    let active = true;
    apiGet<{ categories: CategoryDTO[] }>("/api/categories")
      .then((d) => {
        if (active) setCategories(d.categories);
      })
      .catch(() => {
        if (active) setCategoryFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    setImage("");
    setFailed(false);
    try {
      const target = menuQrUrl(window.location.origin, destination, campaign);
      setUrl(target);
      import("qrcode")
        .then((q) =>
          q.toDataURL(target, {
            width: 768,
            margin: 4,
            errorCorrectionLevel: "H",
            color: { dark: "#26201a", light: "#ffffff" },
          }),
        )
        .then((data) => {
          if (active) setImage(data);
        })
        .catch(() => {
          if (active) setFailed(true);
        });
    } catch {
      setFailed(true);
    }
    return () => {
      active = false;
    };
  }, [destination, campaign]);
  const download = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image;
    a.download = "cafe-menu-qr.png";
    a.click();
  };
  const print = () => {
    if (!image) return;
    const popup = window.open("", "_blank", "width=720,height=900");
    if (!popup) {
      toast.error("Allow pop-ups to print your QR poster.");
      return;
    }
    popup.document.write(
      `<!doctype html><html lang="en"><meta charset="utf-8"><title>Menu QR poster</title><style>@page{size:A5;margin:12mm}body{font:16px/1.5 system-ui;color:#26201a;text-align:center;margin:0}.poster{border:2px solid #a9652a;border-radius:24px;padding:32px 20px}h1{font-size:32px;margin:12px 0}h2{font-size:22px}img{width:260px;max-width:100%;height:auto}p{overflow-wrap:anywhere}small{font-size:11px;color:#65584d}</style><div class="poster"><p>THE MENU IS RIGHT HERE</p><h1>${escapeMarkup(settings.cafeName)}</h1><h2>${escapeMarkup(headline)}</h2><img alt="Scan to open the menu" src="${image}"><p>Scan • Choose • Order</p><small>${escapeMarkup(url)}</small></div></html>`,
    );
    popup.document.close();
    const img = popup.document.querySelector("img");
    const ready = () => {
      popup.focus();
      popup.print();
    };
    if (img?.complete) ready();
    else if (img) img.onload = ready;
  };
  return (
    <div>
      <PageHeader
        title="QR menu studio"
        description="Create a scan-to-order counter card, takeaway insert or campaign poster. No subscription needed."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="surface space-y-5 p-5 sm:p-6">
          <Select
            label="Where should the QR open?"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          >
            <option value="/menu">Full menu</option>
            <option value="/meal-finder">Smart meal finder</option>
            {categories.map((c) => (
              <option key={c.id} value={`/menu/${c.slug}`}>
                {c.name}
              </option>
            ))}
          </Select>
          {categoryFailed && (
            <p role="status" className="text-sm text-amber-700">
              Category links could not load. Full menu and meal finder QR codes
              still work.
            </p>
          )}
          <Input
            label="Poster headline"
            maxLength={90}
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
          />
          <Input
            label="Campaign label (optional)"
            maxLength={80}
            placeholder="counter-card-november"
            hint="Adds standard campaign tags to the link; this does not count scans by itself."
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
          />
          <p className="break-all rounded-xl bg-cream-100 p-3 font-mono text-xs text-charcoal-600">
            {url || "Preparing your link…"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={download} disabled={!image}>
              <Download className="h-4 w-4" />
              Save QR PNG
            </Button>
            <Button variant="secondary" disabled={!image} onClick={print}>
              <Printer className="h-4 w-4" />
              Print poster
            </Button>
            <Button
              variant="secondary"
              disabled={!url}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Menu link copied.");
                } catch {
                  toast.error("Copy the displayed link manually.");
                }
              }}
            >
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-charcoal-500">
            QR codes use the current website domain. Recreate printed materials
            if the domain changes. Test one print with a phone before printing
            in bulk.
          </p>
        </div>
        <div className="surface flex flex-col items-center justify-center border-chai-300 p-6 text-center sm:p-10">
          <span className="eyebrow">Scan something delicious</span>
          <h2 className="mt-4 break-words text-3xl font-extrabold">
            {settings.cafeName}
          </h2>
          <p className="mt-3 break-words text-lg text-charcoal-600">
            {headline}
          </p>
          {image ? (
            <Image
              unoptimized
              src={image}
              alt="QR code linking to your selected menu"
              width={288}
              height={288}
              className="my-5 h-auto w-full max-w-72 rounded-xl bg-white"
            />
          ) : (
            <div
              role="status"
              className="my-5 flex h-64 items-center justify-center text-charcoal-400"
            >
              <QrCode className="mr-3 h-7 w-7" />
              {failed
                ? "QR generation failed. Change the selection to retry."
                : "Generating QR…"}
            </div>
          )}
          <p className="font-semibold text-chai-700">Scan. Choose. Enjoy.</p>
          <p className="mt-2 text-xs text-charcoal-500">
            Opens instantly in a phone browser.
          </p>
        </div>
      </div>
    </div>
  );
}
