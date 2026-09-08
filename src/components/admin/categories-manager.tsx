"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from "@/lib/api-client";
import { PageHeader, DataTable, TableSkeleton, Modal } from "./ui";
import { ImageUpload } from "./image-upload";
import { Button, Input, Textarea, Checkbox, ErrorState, Badge } from "@/components/ui";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount: number;
};

const BLANK = {
  name: "", slug: "", description: "", image: "", icon: "", sortOrder: "0", isActive: true,
};

export function CategoriesManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await apiGet<{ categories: Category[] }>("/api/admin/categories");
      setCategories(data.categories);
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
    setForm({ ...BLANK, sortOrder: String(categories.length + 1) });
    setEditing(null);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (category: Category) => {
    setForm({
      name: category.name,
      slug: category.slug,
      description: category.description ?? "",
      image: category.image ?? "",
      icon: category.icon ?? "",
      sortOrder: String(category.sortOrder),
      isActive: category.isActive,
    });
    setEditing(category);
    setErrors({});
    setModalOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setSaving(true);
    const payload = { ...form, sortOrder: Number(form.sortOrder) };
    try {
      if (editing) {
        await apiPut(`/api/admin/categories/${editing.id}`, payload);
        toast.success("Category updated");
      } else {
        await apiPost("/api/admin/categories", payload);
        toast.success("Category created");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) setErrors(err.fields);
        toast.error(err.message);
      } else {
        toast.error("Couldn't save this category.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category: Category) => {
    if (!window.confirm(`Delete the "${category.name}" category?`)) return;
    try {
      await apiDelete(`/api/admin/categories/${category.id}`);
      toast.success("Category deleted");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete this category.");
    }
  };

  const set = (key: keyof typeof form, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: [] }));
  };

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Menu sections shown on the storefront."
        action={<Button onClick={openCreate}><Plus className="h-4 w-4" aria-hidden /> Add category</Button>}
      />

      {error ? (
        <ErrorState title="Unable to load categories." onRetry={load} />
      ) : loading && categories.length === 0 ? (
        <TableSkeleton cols={5} />
      ) : (
        <DataTable columns={["Category", "Slug", "Products", "Order", "Status", "Actions"]} empty={categories.length === 0}>
          {categories.map((category) => (
            <tr key={category.id} className="transition hover:bg-cream-50">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-cream-200 text-lg">
                    {category.image ? (
                      <Image src={category.image} alt="" fill sizes="44px" className="object-cover" unoptimized={category.image.startsWith("/uploads")} />
                    ) : (
                      <span aria-hidden>{category.icon || "🍽"}</span>
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-charcoal-900">
                      {category.icon && <span className="mr-1.5" aria-hidden>{category.icon}</span>}
                      {category.name}
                    </p>
                    {category.description && (
                      <p className="truncate text-xs text-charcoal-400">{category.description}</p>
                    )}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-xs text-charcoal-500">{category.slug}</td>
              <td className="px-4 py-3 text-charcoal-600">{category.productCount}</td>
              <td className="px-4 py-3 text-charcoal-500">{category.sortOrder}</td>
              <td className="px-4 py-3">
                <Badge tone={category.isActive ? "green" : "red"}>
                  {category.isActive ? "Active" : "Hidden"}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(category)}
                    aria-label={`Edit ${category.name}`}
                    className="rounded-lg p-1.5 text-charcoal-400 transition hover:bg-cream-100 hover:text-chai-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(category)}
                    aria-label={`Delete ${category.name}`}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `Edit ${editing.name}` : "Add category"}>
        <form onSubmit={save} className="space-y-4" noValidate>
          <Input label="Name" name="name" value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name?.[0]} required />
          <Input label="Slug" name="slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} error={errors.slug?.[0]} hint="Leave blank to generate from the name." />
          <Textarea label="Description" name="description" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} error={errors.description?.[0]} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Icon (emoji)" name="icon" value={form.icon} onChange={(e) => set("icon", e.target.value)} error={errors.icon?.[0]} placeholder="☕" />
            <Input label="Sort order" name="sortOrder" type="number" min={0} value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} error={errors.sortOrder?.[0]} />
          </div>
          <ImageUpload value={form.image} onChange={(url) => set("image", url)} label="Category image" />
          <Checkbox name="isActive" label="Show this category on the storefront" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          <div className="flex gap-2 border-t border-cream-200 pt-4">
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Create category"}</Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
