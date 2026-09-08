"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Eye, EyeOff } from "lucide-react";
import { apiGet, apiPost, apiPut, apiDelete, ApiError } from "@/lib/api-client";
import { useMoney } from "@/context/settings-context";
import { PageHeader, DataTable, TableSkeleton, Modal } from "./ui";
import { ImageUpload } from "./image-upload";
import { Button, Input, Select, Textarea, Checkbox, ErrorState, Badge } from "@/components/ui";
import { cn } from "@/lib/utils";

type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription: string | null;
  categoryId: string;
  price: number;
  discountPrice: number | null;
  image: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  isVegetarian: boolean;
  spiceLevel: "NONE" | "MILD" | "MEDIUM" | "HOT";
  prepTimeMinutes: number;
  ingredients: string[];
  calories: number | null;
  stock: number | null;
  sortOrder: number;
  soldCount: number;
  ratingAverage: number;
  category: { id: string; name: string; slug: string };
  addonGroupIds: string[];
};

type Category = { id: string; name: string; slug: string };
type AddonGroup = { id: string; name: string; slug: string };

type ProductForm = {
  name: string; slug: string; description: string; longDescription: string;
  categoryId: string; price: string; discountPrice: string; image: string;
  isAvailable: boolean; isFeatured: boolean; isPopular: boolean; isVegetarian: boolean;
  spiceLevel: AdminProduct["spiceLevel"];
  prepTimeMinutes: string; ingredients: string; calories: string; stock: string;
  sortOrder: string; addonGroupIds: string[];
};

const BLANK: ProductForm = {
  name: "", slug: "", description: "", longDescription: "", categoryId: "",
  price: "", discountPrice: "", image: "", isAvailable: true, isFeatured: false,
  isPopular: false, isVegetarian: false, spiceLevel: "NONE",
  prepTimeMinutes: "10", ingredients: "", calories: "", stock: "", sortOrder: "0",
  addonGroupIds: [],
};

export function ProductsManager() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState({ search: "", category: "", status: "all" });

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [form, setForm] = useState<ProductForm>(BLANK);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  const money = useMoney();

  const load = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({ page: String(targetPage), perPage: "20", status: filters.status });
        if (filters.search.trim()) params.set("search", filters.search.trim());
        if (filters.category) params.set("category", filters.category);

        const data = await apiGet<{
          products: AdminProduct[]; total: number; totalPages: number;
        }>(`/api/admin/products?${params}`);
        setProducts(data.products);
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setPage(targetPage);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [filters],
  );

  useEffect(() => {
    void Promise.all([
      apiGet<{ categories: Category[] }>("/api/admin/categories").then((d) => setCategories(d.categories)),
      apiGet<{ groups: AddonGroup[] }>("/api/admin/addon-groups").then((d) => setAddonGroups(d.groups)),
    ]).catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(1), 260);
    return () => clearTimeout(timer);
  }, [load]);

  const openCreate = () => {
    setForm({ ...BLANK, categoryId: categories[0]?.id ?? "" });
    setEditing(null);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (product: AdminProduct) => {
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      longDescription: product.longDescription ?? "",
      categoryId: product.categoryId,
      price: String(product.price),
      discountPrice: product.discountPrice ? String(product.discountPrice) : "",
      image: product.image ?? "",
      isAvailable: product.isAvailable,
      isFeatured: product.isFeatured,
      isPopular: product.isPopular,
      isVegetarian: product.isVegetarian,
      spiceLevel: product.spiceLevel,
      prepTimeMinutes: String(product.prepTimeMinutes),
      ingredients: product.ingredients.join(", "),
      calories: product.calories ? String(product.calories) : "",
      stock: product.stock !== null ? String(product.stock) : "",
      sortOrder: String(product.sortOrder),
      addonGroupIds: product.addonGroupIds,
    });
    setEditing(product);
    setErrors({});
    setModalOpen(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setSaving(true);

    const payload = {
      name: form.name,
      slug: form.slug,
      description: form.description,
      longDescription: form.longDescription,
      categoryId: form.categoryId,
      price: Number(form.price),
      discountPrice: form.discountPrice ? Number(form.discountPrice) : null,
      image: form.image,
      isAvailable: form.isAvailable,
      isFeatured: form.isFeatured,
      isPopular: form.isPopular,
      isVegetarian: form.isVegetarian,
      spiceLevel: form.spiceLevel,
      prepTimeMinutes: Number(form.prepTimeMinutes),
      ingredients: form.ingredients.split(",").map((i) => i.trim()).filter(Boolean),
      calories: form.calories ? Number(form.calories) : null,
      stock: form.stock === "" ? null : Number(form.stock),
      sortOrder: Number(form.sortOrder),
      addonGroupIds: form.addonGroupIds,
    };

    try {
      if (editing) {
        await apiPut(`/api/admin/products/${editing.id}`, payload);
        toast.success("Product updated");
      } else {
        await apiPost("/api/admin/products", payload);
        toast.success("Product created");
      }
      setModalOpen(false);
      await load(page);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.fields) setErrors(err.fields);
        toast.error(err.message);
      } else {
        toast.error("Couldn't save this product.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (product: AdminProduct) => {
    if (!window.confirm(`Delete "${product.name}"? Items used in past orders are hidden instead.`)) return;
    try {
      const data = await apiDelete<{ message: string }>(`/api/admin/products/${product.id}`);
      toast.success(data.message);
      await load(page);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't delete this product.");
    }
  };

  const toggleAvailability = async (product: AdminProduct) => {
    try {
      await apiPut(`/api/admin/products/${product.id}`, {
        name: product.name,
        slug: product.slug,
        description: product.description,
        longDescription: product.longDescription ?? "",
        categoryId: product.categoryId,
        price: product.price,
        discountPrice: product.discountPrice,
        image: product.image ?? "",
        isAvailable: !product.isAvailable,
        isFeatured: product.isFeatured,
        isPopular: product.isPopular,
        isVegetarian: product.isVegetarian,
        spiceLevel: product.spiceLevel,
        prepTimeMinutes: product.prepTimeMinutes,
        ingredients: product.ingredients,
        calories: product.calories,
        stock: product.stock,
        sortOrder: product.sortOrder,
        addonGroupIds: product.addonGroupIds,
      });
      setProducts((current) =>
        current.map((p) => (p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p)),
      );
      toast.success(product.isAvailable ? "Hidden from the menu" : "Back on the menu");
    } catch {
      toast.error("Couldn't update availability.");
    }
  };

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: [] }));
  };

  return (
    <div>
      <PageHeader
        title="Products"
        description={`${total} item${total === 1 ? "" : "s"} on the menu.`}
        action={
          <Button onClick={openCreate} disabled={categories.length === 0}>
            <Plus className="h-4 w-4" aria-hidden /> Add product
          </Button>
        }
      />

      <div className="surface mb-5 grid gap-3 p-4 sm:grid-cols-3">
        <div className="relative">
          <label htmlFor="product-search" className="label">Search</label>
          <Search className="pointer-events-none absolute left-3.5 top-[34px] h-4 w-4 text-charcoal-300" aria-hidden />
          <input
            id="product-search"
            type="search"
            value={filters.search}
            onChange={(e) => setFilters((c) => ({ ...c, search: e.target.value }))}
            placeholder="Search by name"
            className="field pl-10"
          />
        </div>
        <Select
          label="Category"
          value={filters.category}
          onChange={(e) => setFilters((c) => ({ ...c, category: e.target.value }))}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </Select>
        <Select
          label="Availability"
          value={filters.status}
          onChange={(e) => setFilters((c) => ({ ...c, status: e.target.value }))}
        >
          <option value="all">All</option>
          <option value="available">Available</option>
          <option value="unavailable">Hidden</option>
        </Select>
      </div>

      {error ? (
        <ErrorState title="Unable to load products." onRetry={() => void load(page)} />
      ) : loading && products.length === 0 ? (
        <TableSkeleton cols={6} />
      ) : (
        <>
          <DataTable
            columns={["Product", "Category", "Price", "Stock", "Sold", "Flags", "Actions"]}
            empty={products.length === 0}
          >
            {products.map((product) => (
              <tr key={product.id} className={cn("transition hover:bg-cream-50", !product.isAvailable && "opacity-60")}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-cream-200">
                      {product.image && (
                        <Image
                          src={product.image}
                          alt=""
                          fill
                          sizes="44px"
                          className="object-cover"
                          unoptimized={product.image.startsWith("/uploads")}
                        />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-charcoal-900">{product.name}</p>
                      <p className="truncate font-mono text-[11px] text-charcoal-400">{product.slug}</p>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-charcoal-600">{product.category.name}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className="font-bold text-charcoal-900">
                    {money(product.discountPrice ?? product.price)}
                  </span>
                  {product.discountPrice && (
                    <span className="ml-1.5 text-xs text-charcoal-300 line-through">{money(product.price)}</span>
                  )}
                </td>
                <td className="px-4 py-3 text-charcoal-600">
                  {product.stock === null ? (
                    <span className="text-xs text-charcoal-400">Unlimited</span>
                  ) : (
                    <span className={cn("font-semibold", product.stock <= 5 && "text-chilli-600")}>
                      {product.stock}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-charcoal-500">{product.soldCount}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {product.isPopular && <Badge tone="chai">Popular</Badge>}
                    {product.isFeatured && <Badge tone="dark">Featured</Badge>}
                    {product.isVegetarian && <Badge tone="green">Veg</Badge>}
                    {!product.isAvailable && <Badge tone="red">Hidden</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => void toggleAvailability(product)}
                      aria-label={product.isAvailable ? `Hide ${product.name}` : `Show ${product.name}`}
                      className="rounded-lg p-1.5 text-charcoal-400 transition hover:bg-cream-100 hover:text-chai-600"
                    >
                      {product.isAvailable ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(product)}
                      aria-label={`Edit ${product.name}`}
                      className="rounded-lg p-1.5 text-charcoal-400 transition hover:bg-cream-100 hover:text-chai-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(product)}
                      aria-label={`Delete ${product.name}`}
                      className="rounded-lg p-1.5 text-charcoal-400 transition hover:bg-chilli-400/10 hover:text-chilli-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>

          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between gap-3">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => void load(page - 1)}>Previous</Button>
              <span className="text-sm text-charcoal-500">Page {page} of {totalPages}</span>
              <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => void load(page + 1)}>Next</Button>
            </div>
          )}
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add product"}
        size="lg"
      >
        <form onSubmit={save} className="space-y-5" noValidate>
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <Input label="Name" name="name" value={form.name} onChange={(e) => set("name", e.target.value)} error={errors.name?.[0]} required />
              <Input label="Slug" name="slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} error={errors.slug?.[0]} hint="Leave blank to generate from the name." />
              <Textarea label="Short description" name="description" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} error={errors.description?.[0]} required />
              <Select label="Category" name="categoryId" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} error={errors.categoryId?.[0]} required>
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>

            <div className="space-y-4">
              <ImageUpload value={form.image} onChange={(url) => set("image", url)} />
              <Textarea label="Long description" name="longDescription" rows={3} value={form.longDescription} onChange={(e) => set("longDescription", e.target.value)} error={errors.longDescription?.[0]} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Price (Rs.)" name="price" type="number" min={1} value={form.price} onChange={(e) => set("price", e.target.value)} error={errors.price?.[0]} required />
            <Input label="Discount price" name="discountPrice" type="number" min={0} value={form.discountPrice} onChange={(e) => set("discountPrice", e.target.value)} error={errors.discountPrice?.[0]} hint="Blank = none" />
            <Input label="Prep time (min)" name="prepTimeMinutes" type="number" min={1} value={form.prepTimeMinutes} onChange={(e) => set("prepTimeMinutes", e.target.value)} error={errors.prepTimeMinutes?.[0]} />
            <Input label="Stock" name="stock" type="number" min={0} value={form.stock} onChange={(e) => set("stock", e.target.value)} error={errors.stock?.[0]} hint="Blank = unlimited" />
            <Input label="Calories" name="calories" type="number" min={0} value={form.calories} onChange={(e) => set("calories", e.target.value)} error={errors.calories?.[0]} />
            <Select label="Spice level" name="spiceLevel" value={form.spiceLevel} onChange={(e) => set("spiceLevel", e.target.value as ProductForm["spiceLevel"])}>
              <option value="NONE">Not spicy</option>
              <option value="MILD">Mild</option>
              <option value="MEDIUM">Medium</option>
              <option value="HOT">Hot</option>
            </Select>
            <Input label="Sort order" name="sortOrder" type="number" min={0} value={form.sortOrder} onChange={(e) => set("sortOrder", e.target.value)} error={errors.sortOrder?.[0]} />
          </div>

          <Input
            label="Ingredients"
            name="ingredients"
            value={form.ingredients}
            onChange={(e) => set("ingredients", e.target.value)}
            error={errors.ingredients?.[0]}
            hint="Comma separated, e.g. Milk, Tea leaves, Cardamom"
          />

          <fieldset>
            <legend className="label">Customisation groups</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {addonGroups.map((group) => (
                <Checkbox
                  key={group.id}
                  name={`group-${group.id}`}
                  label={group.name}
                  checked={form.addonGroupIds.includes(group.id)}
                  onChange={(e) =>
                    set(
                      "addonGroupIds",
                      e.target.checked
                        ? [...form.addonGroupIds, group.id]
                        : form.addonGroupIds.filter((id) => id !== group.id),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="label">Flags</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox name="isAvailable" label="Available on the menu" checked={form.isAvailable} onChange={(e) => set("isAvailable", e.target.checked)} />
              <Checkbox name="isPopular" label="Popular" description="Shows a badge and ranks higher" checked={form.isPopular} onChange={(e) => set("isPopular", e.target.checked)} />
              <Checkbox name="isFeatured" label="Featured" description="Eligible for homepage features" checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
              <Checkbox name="isVegetarian" label="Vegetarian" checked={form.isVegetarian} onChange={(e) => set("isVegetarian", e.target.checked)} />
            </div>
          </fieldset>

          <div className="flex gap-2 border-t border-cream-200 pt-4">
            <Button type="submit" loading={saving}>{editing ? "Save changes" : "Create product"}</Button>
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
