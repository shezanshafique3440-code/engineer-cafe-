"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { apiGet, apiPut, ApiError } from "@/lib/api-client";
import { PageHeader } from "./ui";
import { ImageUpload } from "./image-upload";
import { Button, Input, Textarea, Checkbox, ErrorState } from "@/components/ui";

type Settings = {
  cafeName: string; tagline: string; logoUrl: string | null; phone: string;
  whatsapp: string; email: string; address: string; city: string; mapsQuery: string;
  openingHours: string; deliveryFee: number; freeDeliveryOver: number | null;
  minOrderAmount: number; taxPercent: number; currency: string; currencySymbol: string;
  instagramUrl: string | null; facebookUrl: string | null; tiktokUrl: string | null;
  codEnabled: boolean; cashAtCounterEnabled: boolean; onlinePaymentEnabled: boolean;
  isAcceptingOrders: boolean;
};

type Form = Record<string, string | boolean>;

function toForm(settings: Settings): Form {
  return {
    cafeName: settings.cafeName,
    tagline: settings.tagline,
    logoUrl: settings.logoUrl ?? "",
    phone: settings.phone,
    whatsapp: settings.whatsapp,
    email: settings.email,
    address: settings.address,
    city: settings.city,
    mapsQuery: settings.mapsQuery,
    openingHours: settings.openingHours,
    deliveryFee: String(settings.deliveryFee),
    freeDeliveryOver: settings.freeDeliveryOver !== null ? String(settings.freeDeliveryOver) : "",
    minOrderAmount: String(settings.minOrderAmount),
    taxPercent: String(settings.taxPercent),
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    instagramUrl: settings.instagramUrl ?? "",
    facebookUrl: settings.facebookUrl ?? "",
    tiktokUrl: settings.tiktokUrl ?? "",
    codEnabled: settings.codEnabled,
    cashAtCounterEnabled: settings.cashAtCounterEnabled,
    onlinePaymentEnabled: settings.onlinePaymentEnabled,
    isAcceptingOrders: settings.isAcceptingOrders,
  };
}

export function SettingsManager() {
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await apiGet<{ settings: Settings }>("/api/admin/settings");
      setForm(toForm(data.settings));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = (key: string, value: string | boolean) => {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setErrors((current) => ({ ...current, [key]: [] }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setErrors({});
    setSaving(true);

    try {
      await apiPut("/api/admin/settings", {
        ...form,
        deliveryFee: Number(form.deliveryFee),
        freeDeliveryOver: form.freeDeliveryOver ? Number(form.freeDeliveryOver) : null,
        minOrderAmount: Number(form.minOrderAmount),
        taxPercent: Number(form.taxPercent),
      });
      toast.success("Settings saved — the storefront is updated.");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) setErrors(err.fields);
        toast.error(err.message);
      } else {
        toast.error("Couldn't save these settings.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div>
        <PageHeader title="Settings" />
        <ErrorState title="Unable to load settings." onRetry={load} />
      </div>
    );
  }

  if (loading || !form) {
    return (
      <div>
        <PageHeader title="Settings" />
        <div className="surface h-96 animate-pulse" />
      </div>
    );
  }

  const str = (key: string) => String(form[key] ?? "");
  const bool = (key: string) => Boolean(form[key]);

  return (
    <form onSubmit={save}>
      <PageHeader
        title="Settings"
        description="These values drive the storefront — no redeploy needed."
        action={
          <Button type="submit" loading={saving}>
            <Save className="h-4 w-4" aria-hidden /> Save changes
          </Button>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="surface p-5" aria-labelledby="brand-heading">
          <h2 id="brand-heading" className="mb-4 text-lg font-bold">Brand</h2>
          <div className="space-y-4">
            <Input label="Cafe name" name="cafeName" value={str("cafeName")} onChange={(e) => set("cafeName", e.target.value)} error={errors.cafeName?.[0]} required />
            <Input label="Tagline" name="tagline" value={str("tagline")} onChange={(e) => set("tagline", e.target.value)} error={errors.tagline?.[0]} />
            <ImageUpload value={str("logoUrl")} onChange={(url) => set("logoUrl", url)} label="Logo" />
          </div>
        </section>

        <section className="surface p-5" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="mb-4 text-lg font-bold">Contact</h2>
          <div className="space-y-4">
            <Input label="Phone" name="phone" value={str("phone")} onChange={(e) => set("phone", e.target.value)} error={errors.phone?.[0]} required />
            <Input label="WhatsApp number" name="whatsapp" value={str("whatsapp")} onChange={(e) => set("whatsapp", e.target.value)} error={errors.whatsapp?.[0]} hint="Digits only, with country code — e.g. 923001234567" required />
            <Input label="Email" name="email" type="email" value={str("email")} onChange={(e) => set("email", e.target.value)} error={errors.email?.[0]} required />
            <Textarea label="Address" name="address" rows={2} value={str("address")} onChange={(e) => set("address", e.target.value)} error={errors.address?.[0]} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="City" name="city" value={str("city")} onChange={(e) => set("city", e.target.value)} error={errors.city?.[0]} required />
              <Input label="Opening hours" name="openingHours" value={str("openingHours")} onChange={(e) => set("openingHours", e.target.value)} error={errors.openingHours?.[0]} />
            </div>
            <Input label="Google Maps search query" name="mapsQuery" value={str("mapsQuery")} onChange={(e) => set("mapsQuery", e.target.value)} error={errors.mapsQuery?.[0]} hint="Used for the embedded map" />
          </div>
        </section>

        <section className="surface p-5" aria-labelledby="ordering-heading">
          <h2 id="ordering-heading" className="mb-4 text-lg font-bold">Ordering &amp; fees</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Delivery fee (Rs.)" name="deliveryFee" type="number" min={0} value={str("deliveryFee")} onChange={(e) => set("deliveryFee", e.target.value)} error={errors.deliveryFee?.[0]} />
            <Input label="Free delivery over (Rs.)" name="freeDeliveryOver" type="number" min={0} value={str("freeDeliveryOver")} onChange={(e) => set("freeDeliveryOver", e.target.value)} error={errors.freeDeliveryOver?.[0]} hint="Blank = never free" />
            <Input label="Minimum order (Rs.)" name="minOrderAmount" type="number" min={0} value={str("minOrderAmount")} onChange={(e) => set("minOrderAmount", e.target.value)} error={errors.minOrderAmount?.[0]} />
            <Input label="Tax (%)" name="taxPercent" type="number" min={0} step="0.01" value={str("taxPercent")} onChange={(e) => set("taxPercent", e.target.value)} error={errors.taxPercent?.[0]} />
            <Input label="Currency code" name="currency" value={str("currency")} onChange={(e) => set("currency", e.target.value)} error={errors.currency?.[0]} />
            <Input label="Currency symbol" name="currencySymbol" value={str("currencySymbol")} onChange={(e) => set("currencySymbol", e.target.value)} error={errors.currencySymbol?.[0]} hint="Shown as “Rs. 250”" />
          </div>

          <div className="mt-5 space-y-2">
            <Checkbox name="isAcceptingOrders" label="Accepting orders" description="Turn off to pause the kitchen — checkout is blocked." checked={bool("isAcceptingOrders")} onChange={(e) => set("isAcceptingOrders", e.target.checked)} />
            <Checkbox name="codEnabled" label="Cash on Delivery" checked={bool("codEnabled")} onChange={(e) => set("codEnabled", e.target.checked)} />
            <Checkbox name="cashAtCounterEnabled" label="Cash at Counter (pickup)" checked={bool("cashAtCounterEnabled")} onChange={(e) => set("cashAtCounterEnabled", e.target.checked)} />
            <Checkbox
              name="onlinePaymentEnabled"
              label="Online payment"
              description="Enable once a payment provider is configured in your environment variables."
              checked={bool("onlinePaymentEnabled")}
              onChange={(e) => set("onlinePaymentEnabled", e.target.checked)}
            />
          </div>
        </section>

        <section className="surface p-5" aria-labelledby="social-heading">
          <h2 id="social-heading" className="mb-4 text-lg font-bold">Social links</h2>
          <div className="space-y-4">
            <Input label="Instagram URL" name="instagramUrl" type="url" value={str("instagramUrl")} onChange={(e) => set("instagramUrl", e.target.value)} error={errors.instagramUrl?.[0]} placeholder="https://instagram.com/…" />
            <Input label="Facebook URL" name="facebookUrl" type="url" value={str("facebookUrl")} onChange={(e) => set("facebookUrl", e.target.value)} error={errors.facebookUrl?.[0]} placeholder="https://facebook.com/…" />
            <Input label="TikTok URL" name="tiktokUrl" type="url" value={str("tiktokUrl")} onChange={(e) => set("tiktokUrl", e.target.value)} error={errors.tiktokUrl?.[0]} placeholder="https://tiktok.com/@…" />
          </div>

          <p className="mt-6 rounded-xl bg-cream-100 p-4 font-mono text-xs leading-relaxed text-charcoal-500">
            {"// Payment provider keys and image storage credentials live in environment variables, never in the database."}
          </p>
        </section>
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="submit" size="lg" loading={saving}>
          <Save className="h-4 w-4" aria-hidden /> Save changes
        </Button>
      </div>
    </form>
  );
}
