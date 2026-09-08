"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Ticket } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from "@/lib/api-client";
import { useMoney } from "@/context/settings-context";
import { PageHeader, DataTable, TableSkeleton, Modal } from "./ui";
import { Button, Input, Select, Textarea, Checkbox, ErrorState, Badge } from "@/components/ui";
import { formatDate } from "@/lib/utils";

type Coupon = {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  maxUsage: number | null;
  usageCount: number;
  perUserLimit: number | null;
  startsAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
};

type CouponForm = {
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  minOrderAmount: string;
  maxDiscount: string;
  maxUsage: string;
  perUserLimit: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
};

const BLANK: CouponForm = {
  code: "", description: "", discountType: "PERCENTAGE", discountValue: "",
  minOrderAmount: "0", maxDiscount: "", maxUsage: "", perUserLimit: "",
  startsAt: "", expiresAt: "", isActive: true,
};

/** <input type="date"> wants YYYY-MM-DD; the API wants full ISO. */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const toIso = (value: string) => (value ? new Date(`${value}T00:00:00`).toISOString() : null);

export function CouponsManager() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(BLANK);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const money = useMoney();

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await apiGet<{ coupons: Coupon[] }>("/api/admin/coupons");
      setCoupons(data.coupons);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setForm(BLANK);
    setEditing(null);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setForm({
      code: coupon.code,
      description: coupon.description ?? "",
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      minOrderAmount: String(coupon.minOrderAmount),
      maxDiscount: coupon.maxDiscount ? String(coupon.maxDiscount) : "",
      maxUsage: coupon.maxUsage ? String(coupon.maxUsage) : "",
      perUserLimit: coupon.perUserLimit ? String(coupon.perUserLimit) : "",
      startsAt: toDateInput(coupon.startsAt),
      expiresAt: toDateInput(coupon.expiresAt),
      isActive: coupon.isActive,
    });
    setEditing(coupon);
    setErrors({});
    setModalOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setSaving(true);

    const payload = {
      code: form.code,
      description: form.description,
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      minOrderAmount: Number(form.minOrderAmount || 0),
      maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
      maxUsage: form.maxUsage ? Number(form.maxUsage) : null,
      perUserLimit: form.perUserLimit ? Number(form.perUserLimit) : null,
      startsAt: toIso(form.startsAt),
      expiresAt: toIso(form.expiresAt),
      isActive: form.isActive,
    };

    try {
      if (editing) {
        await apiPut(`/api/admin/coupons/${editing.id}`, payload);
        toast.success("Coupon updated");
      } else {
        await apiPost("/api/admin/coupons", payload);
        toast.success("Coupon created");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) setErrors(err.fields);
        toast.error(err.message);
      } else {
        toast.error("Couldn't save this coupon.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (coupon: Coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}?`)) return;
    try {
      const data = await apiDelete<{ message: string }>(`/api/admin/coupons/${coupon.id}`);
      toast.success(data.message);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete this coupon.");
    }
  };

  const set = <K extends keyof CouponForm>(key: K, value: CouponForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: [] }));
  };

  const expired = (coupon: Coupon) =>
    Boolean(coupon.expiresAt && new Date(coupon.expiresAt) < new Date());

  return (
    <div>
      <PageHeader
        title="Coupons"
        description="Promo codes validated on the server at checkout."
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" aria-hidden /> Add coupon</Button>}
      />

      {error ? (
        <ErrorState title="Unable to load coupons." onRetry={load} />
      ) : loading && coupons.length === 0 ? (
        <TableSkeleton cols={6} />
      ) : (
        <DataTable
          columns={["Code", "Discount", "Min order", "Usage", "Expires", "Status", "Actions"]}
          empty={coupons.length === 0}
        >
          {coupons.map((coupon) => (
            <tr key={coupon.id} className="transition hover:bg-cream-50">
              <td className="px-4 py-3">
                <p className="flex items-center gap-2 font-mono font-bold text-chai-700">
                  <Ticket className="h-3.5 w-3.5" aria-hidden />
                  {coupon.code}
                </p>
                {coupon.description && (
                  <p className="mt-0.5 max-w-xs truncate text-xs text-charcoal-400">{coupon.description}</p>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 font-semibold text-charcoal-900">
                {coupon.discountType === "PERCENTAGE"
                  ? `${coupon.discountValue}%`
                  : money(coupon.discountValue)}
                {coupon.maxDiscount && (
                  <span className="block text-xs font-normal text-charcoal-400">
                    max {money(coupon.maxDiscount)}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-charcoal-600">
                {coupon.minOrderAmount > 0 ? money(coupon.minOrderAmount) : "—"}
              </td>
              <td className="px-4 py-3 text-charcoal-600">
                {coupon.usageCount}
                {coupon.maxUsage ? ` / ${coupon.maxUsage}` : ""}
                {coupon.perUserLimit && (
                  <span className="block text-xs text-charcoal-400">{coupon.perUserLimit} per user</span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-charcoal-500">
                {coupon.expiresAt ? formatDate(coupon.expiresAt) : "Never"}
              </td>
              <td className="px-4 py-3">
                {!coupon.isActive ? (
                  <Badge tone="red">Inactive</Badge>
                ) : expired(coupon) ? (
                  <Badge tone="red">Expired</Badge>
                ) : (
                  <Badge tone="green">Active</Badge>
                )}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(coupon)}
                    aria-label={`Edit ${coupon.code}`}
                    className="rounded-lg p-1.5 text-charcoal-400 transition hover:bg-cream-100 hover:text-chai-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(coupon)}
                    aria-label={`Delete ${coupon.code}`}
                    className="rounded-lg p-1.5 text-charcoal-400 transition hover:bg-chilli-400/10 hover:text-chilli-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.code}` : "Add coupon"}>
        <form onSubmit={save} className="space-y-4" noValidate>
          <Input
            label="Code"
            name="code"
            value={form.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            error={errors.code?.[0]}
            className="font-mono uppercase"
            placeholder="ENGINEER10"
            required
          />
          <Textarea label="Description" name="description" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} error={errors.description?.[0]} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Discount type" name="discountType" value={form.discountType} onChange={(e) => set("discountType", e.target.value as CouponForm["discountType"])}>
              <option value="PERCENTAGE">Percentage (%)</option>
              <option value="FIXED">Fixed amount (Rs.)</option>
            </Select>
            <Input
              label={form.discountType === "PERCENTAGE" ? "Discount %" : "Discount (Rs.)"}
              name="discountValue"
              type="number"
              min={1}
              value={form.discountValue}
              onChange={(e) => set("discountValue", e.target.value)}
              error={errors.discountValue?.[0]}
              required
            />
            <Input label="Minimum order (Rs.)" name="minOrderAmount" type="number" min={0} value={form.minOrderAmount} onChange={(e) => set("minOrderAmount", e.target.value)} error={errors.minOrderAmount?.[0]} />
            <Input label="Max discount (Rs.)" name="maxDiscount" type="number" min={0} value={form.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} error={errors.maxDiscount?.[0]} hint="Caps percentage discounts" />
            <Input label="Max total uses" name="maxUsage" type="number" min={0} value={form.maxUsage} onChange={(e) => set("maxUsage", e.target.value)} error={errors.maxUsage?.[0]} hint="Blank = unlimited" />
            <Input label="Uses per customer" name="perUserLimit" type="number" min={0} value={form.perUserLimit} onChange={(e) => set("perUserLimit", e.target.value)} error={errors.perUserLimit?.[0]} hint="Requires login" />
            <div>
              <label htmlFor="startsAt" className="label">Starts on</label>
              <input id="startsAt" type="date" value={form.startsAt} onChange={(e) => set("startsAt", e.target.value)} className="field" />
            </div>
            <div>
              <label htmlFor="expiresAt" className="label">Expires on</label>
              <input id="expiresAt" type="date" value={form.expiresAt} onChange={(e) => set("expiresAt", e.target.value)} className="field" />
            </div>
          </div>

          <Checkbox name="isActive" label="Coupon is active" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />

          <div className="flex gap-2 border-t border-cream-200 pt-4">
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Create coupon"}</Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
