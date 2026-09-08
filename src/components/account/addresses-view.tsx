"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MapPin, Plus, Pencil, Trash2, Star } from "lucide-react";
import { apiPost, apiPut, apiDelete, ApiError } from "@/lib/api-client";
import { Button, Input, Textarea, Checkbox, EmptyState } from "@/components/ui";
import { cn } from "@/lib/utils";

type Address = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine: string;
  area: string | null;
  city: string;
  notes: string | null;
  isDefault: boolean;
};

const BLANK = {
  label: "Home",
  fullName: "",
  phone: "",
  addressLine: "",
  area: "",
  city: "",
  notes: "",
  isDefault: false,
};

export function AddressesView({ initialAddresses }: { initialAddresses: Address[] }) {
  const [addresses, setAddresses] = useState(initialAddresses);
  const [editing, setEditing] = useState<Address | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setForm(BLANK);
    setEditing(null);
    setErrors({});
    setCreating(true);
  };

  const openEdit = (address: Address) => {
    setForm({
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      addressLine: address.addressLine,
      area: address.area ?? "",
      city: address.city,
      notes: address.notes ?? "",
      isDefault: address.isDefault,
    });
    setEditing(address);
    setErrors({});
    setCreating(true);
  };

  const close = () => {
    setCreating(false);
    setEditing(null);
    setErrors({});
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setSaving(true);
    try {
      if (editing) {
        const data = await apiPut<{ address: Address }>(`/api/addresses/${editing.id}`, form);
        setAddresses((current) =>
          current
            .map((a) => (a.id === editing.id ? data.address : form.isDefault ? { ...a, isDefault: false } : a))
            .map((a) => (a.id === data.address.id ? data.address : a)),
        );
        toast.success("Address updated");
      } else {
        const data = await apiPost<{ address: Address }>("/api/addresses", form);
        setAddresses((current) => [
          data.address,
          ...(data.address.isDefault ? current.map((a) => ({ ...a, isDefault: false })) : current),
        ]);
        toast.success("Address saved");
      }
      close();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fields) setErrors(error.fields);
        toast.error(error.message);
      } else {
        toast.error("Couldn't save this address.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (address: Address) => {
    if (!window.confirm(`Delete the "${address.label}" address?`)) return;
    try {
      await apiDelete(`/api/addresses/${address.id}`);
      setAddresses((current) => current.filter((a) => a.id !== address.id));
      toast.success("Address deleted");
    } catch {
      toast.error("Couldn't delete this address.");
    }
  };

  const set = (key: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: [] }));
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Saved Addresses</h1>
          <p className="mt-1.5 text-sm text-charcoal-500">
            Delivery details that autofill at checkout.
          </p>
        </div>
        {!creating && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" aria-hidden /> Add address
          </Button>
        )}
      </div>

      {creating && (
        <form onSubmit={save} className="surface mt-6 space-y-4 p-5" noValidate>
          <h2 className="text-lg font-bold">{editing ? "Edit address" : "New address"}</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Label" name="label" value={form.label} onChange={(e) => set("label", e.target.value)} error={errors.label?.[0]} placeholder="Home, Hostel, Office" required />
            <Input label="Recipient name" name="fullName" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} error={errors.fullName?.[0]} autoComplete="name" required />
            <Input label="Phone" name="phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} error={errors.phone?.[0]} placeholder="03001234567" required />
            <Input label="Area" name="area" value={form.area} onChange={(e) => set("area", e.target.value)} error={errors.area?.[0]} placeholder="Gulberg III" />
            <div className="sm:col-span-2">
              <Textarea label="Street address" name="addressLine" rows={2} value={form.addressLine} onChange={(e) => set("addressLine", e.target.value)} error={errors.addressLine?.[0]} required />
            </div>
            <Input label="City" name="city" value={form.city} onChange={(e) => set("city", e.target.value)} error={errors.city?.[0]} required />
            <Input label="Delivery notes" name="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} error={errors.notes?.[0]} placeholder="Gate code, landmark…" />
          </div>

          <Checkbox
            name="isDefault"
            label="Make this my default address"
            checked={form.isDefault}
            onChange={(e) => set("isDefault", e.target.checked)}
          />

          <div className="flex gap-2">
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Add address"}</Button>
            <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="mt-6">
        {addresses.length === 0 && !creating ? (
          <EmptyState
            icon={<MapPin className="h-6 w-6" />}
            title="No saved addresses."
            description="Add one so checkout takes ten seconds next time."
            actionLabel="Add address"
            onAction={openCreate}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {addresses.map((address) => (
              <li
                key={address.id}
                className={cn(
                  "surface p-4",
                  address.isDefault && "border-chai-400 ring-1 ring-chai-400/30",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-charcoal-900">
                      {address.label}
                      {address.isDefault && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-chai-100 px-2 py-0.5 text-[10px] font-bold text-chai-700">
                          <Star className="h-2.5 w-2.5 fill-current" aria-hidden /> Default
                        </span>
                      )}
                    </p>
                    <p className="mt-1.5 text-sm text-charcoal-600">{address.fullName}</p>
                    <p className="text-xs text-charcoal-500">{address.phone}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-charcoal-500">
                      {address.addressLine}
                      <br />
                      {[address.area, address.city].filter(Boolean).join(", ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(address)}
                      aria-label={`Edit ${address.label} address`}
                      className="rounded-lg p-2 text-charcoal-400 transition hover:bg-cream-100 hover:text-chai-600"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(address)}
                      aria-label={`Delete ${address.label} address`}
                      className="rounded-lg p-2 text-charcoal-400 transition hover:bg-chilli-400/10 hover:text-chilli-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
