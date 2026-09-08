"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Minus, Plus, Clock, Leaf, Flame, Heart, Star } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api-client";
import { useCart } from "@/context/cart-context";
import { useFavorites } from "@/context/favorites-context";
import { useMoney } from "@/context/settings-context";
import { useSession } from "@/context/session-context";
import { Badge, Button, Rating, Textarea } from "@/components/ui";
import { cn, discountPercent, formatDate } from "@/lib/utils";
import { SPICE_LABEL } from "@/lib/constants";
import type { AddonGroupDTO, ProductDTO } from "@/lib/types";

type Review = { id: string; rating: number; comment: string; createdAt: string; author: string };

function defaultSelection(groups: AddonGroupDTO[]): Record<string, string[]> {
  const selection: Record<string, string[]> = {};
  for (const group of groups) {
    const defaults = group.addons.filter((a) => a.isDefault).map((a) => a.id);
    selection[group.id] = defaults.length
      ? group.type === "SINGLE" ? defaults.slice(0, 1) : defaults
      : group.isRequired && group.addons[0] ? [group.addons[0].id] : [];
  }
  return selection;
}

export function ProductDetail({
  product,
  reviews: initialReviews,
}: {
  product: ProductDTO;
  reviews: Review[];
}) {
  const groups = useMemo(() => product.addonGroups ?? [], [product.addonGroups]);
  const [selection, setSelection] = useState(() => defaultSelection(product.addonGroups ?? []));
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [reviews] = useState(initialReviews);

  const { addItem } = useCart();
  const { isFavorite, toggle } = useFavorites();
  const money = useMoney();

  const chosenAddons = useMemo(() => {
    const chosen: { id: string; name: string; price: number; groupName: string }[] = [];
    for (const group of groups) {
      for (const id of selection[group.id] ?? []) {
        const addon = group.addons.find((a) => a.id === id);
        if (addon) chosen.push({ id: addon.id, name: addon.name, price: addon.price, groupName: group.name });
      }
    }
    return chosen;
  }, [groups, selection]);

  const basePrice = product.discountPrice ?? product.price;
  const addonsTotal = chosenAddons.reduce((sum, a) => sum + a.price, 0);
  const lineTotal = (basePrice + addonsTotal) * quantity;
  const saving = discountPercent(product.price, product.discountPrice);

  const missingRequired = groups.filter(
    (g) => g.isRequired && (selection[g.id]?.length ?? 0) < Math.max(1, g.minSelect),
  );

  const choose = (group: AddonGroupDTO, addonId: string) => {
    setSelection((current) => {
      const existing = current[group.id] ?? [];
      if (group.type === "SINGLE") {
        if (existing.includes(addonId) && !group.isRequired) return { ...current, [group.id]: [] };
        return { ...current, [group.id]: [addonId] };
      }
      if (existing.includes(addonId)) {
        return { ...current, [group.id]: existing.filter((id) => id !== addonId) };
      }
      if (group.maxSelect > 0 && existing.length >= group.maxSelect) return current;
      return { ...current, [group.id]: [...existing, addonId] };
    });
  };

  return (
    <div className="container py-8 md:py-12">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-cream-200 bg-cream-200">
            {product.image ? (
              <Image
                src={product.image}
                alt={product.name}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl" aria-hidden>☕</div>
            )}
            <div className="absolute inset-x-3 top-3 flex flex-wrap gap-1.5">
              {product.isPopular && <Badge tone="dark">🔥 Popular</Badge>}
              {saving && <Badge tone="red">-{saving}% off</Badge>}
              {product.isVegetarian && (
                <Badge tone="green"><Leaf className="h-3 w-3" aria-hidden /> Vegetarian</Badge>
              )}
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Prep time", value: `${product.prepTimeMinutes} min`, icon: Clock },
              { label: "Spice", value: SPICE_LABEL[product.spiceLevel], icon: Flame },
              { label: "Sold", value: `${product.soldCount}+`, icon: Star },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-cream-200 bg-white p-3 text-center">
                <stat.icon className="mx-auto mb-1 h-4 w-4 text-chai-500" aria-hidden />
                <dt className="text-[10px] uppercase tracking-wide text-charcoal-400">{stat.label}</dt>
                <dd className="text-sm font-bold text-charcoal-900">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <p className="eyebrow">{product.category.name}</p>
          <h1 className="mt-1.5 text-3xl font-extrabold leading-tight md:text-4xl">{product.name}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <Rating value={product.ratingAverage} count={product.ratingCount} size={16} />
            {!product.isAvailable && <Badge tone="red">Currently unavailable</Badge>}
          </div>

          <p className="mt-4 text-base leading-relaxed text-charcoal-600">
            {product.longDescription || product.description}
          </p>

          <div className="mt-5 flex items-end gap-3">
            <span className="text-3xl font-extrabold leading-none text-charcoal-900">
              {money(basePrice)}
            </span>
            {product.discountPrice && (
              <span className="pb-1 text-base text-charcoal-300 line-through">{money(product.price)}</span>
            )}
          </div>

          {product.comboItems && product.comboItems.length > 0 && (
            <div className="mt-5 rounded-xl border border-chai-200 bg-chai-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-chai-700">
                What&apos;s in this deal
              </p>
              <ul className="space-y-1.5">
                {product.comboItems.map((item) => (
                  <li key={item.productName} className="flex items-center gap-2 text-sm text-charcoal-700">
                    <span className="h-1 w-1 rounded-full bg-chai-500" aria-hidden />
                    {item.quantity} × {item.productName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {groups.map((group) => (
            <fieldset key={group.id} className="mt-6">
              <legend className="mb-2.5 flex w-full items-center justify-between gap-2">
                <span className="text-sm font-bold text-charcoal-900">
                  {group.name}
                  {group.isRequired && <span className="ml-1 text-chilli-500">*</span>}
                </span>
                <span className="text-[11px] font-medium text-charcoal-400">
                  {group.type === "SINGLE" ? "Choose one" : `Choose up to ${group.maxSelect}`}
                </span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.addons.map((addon) => {
                  const active = (selection[group.id] ?? []).includes(addon.id);
                  return (
                    <label
                      key={addon.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-sm transition",
                        active
                          ? "border-chai-500 bg-chai-50 text-chai-800"
                          : "border-cream-200 bg-white text-charcoal-700 hover:border-chai-300",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <input
                          type={group.type === "SINGLE" ? "radio" : "checkbox"}
                          name={group.id}
                          checked={active}
                          onChange={() => choose(group, addon.id)}
                          className="h-4 w-4 shrink-0 accent-chai-600"
                        />
                        <span className="truncate font-medium">{addon.name}</span>
                      </span>
                      {addon.price > 0 && (
                        <span className="shrink-0 text-xs font-bold text-chai-700">+{money(addon.price)}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div className="mt-6">
            <label htmlFor="detail-notes" className="label">Special instructions</label>
            <input
              id="detail-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              className="field"
              placeholder="e.g. less oil, extra crispy"
            />
          </div>

          {missingRequired.length > 0 && (
            <p className="mt-4 text-xs font-medium text-chilli-600" role="alert">
              Please choose {missingRequired.map((g) => g.name.toLowerCase()).join(" and ")}.
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-xl border border-cream-300 bg-white p-1">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="rounded-lg p-2.5 text-charcoal-600 transition hover:bg-cream-100 disabled:opacity-40"
                aria-label="Decrease quantity"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-8 text-center font-bold" aria-live="polite">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(50, q + 1))}
                className="rounded-lg p-2.5 text-charcoal-600 transition hover:bg-cream-100"
                aria-label="Increase quantity"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <Button
              size="lg"
              className="flex-1 justify-between"
              disabled={!product.isAvailable || missingRequired.length > 0}
              onClick={() => {
                addItem(product, { addons: chosenAddons, quantity, notes: notes || undefined });
                setQuantity(1);
              }}
            >
              <span>{product.isAvailable ? "Add to Cart" : "Unavailable"}</span>
              <span>{money(lineTotal)}</span>
            </Button>

            <button
              type="button"
              onClick={() => void toggle(product.id, product.name)}
              aria-label={isFavorite(product.id) ? "Remove from favorites" : "Save to favorites"}
              aria-pressed={isFavorite(product.id)}
              className="rounded-xl border border-cream-300 bg-white p-3.5 transition hover:border-chilli-300"
            >
              <Heart className={cn("h-5 w-5", isFavorite(product.id) ? "fill-chilli-500 text-chilli-500" : "text-charcoal-400")} />
            </button>
          </div>

          {product.ingredients.length > 0 && (
            <div className="mt-8 border-t border-cream-200 pt-6">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-charcoal-400">
                Ingredients
              </h2>
              <div className="flex flex-wrap gap-2">
                {product.ingredients.map((ingredient) => (
                  <span key={ingredient} className="rounded-full bg-cream-100 px-3 py-1.5 text-xs text-charcoal-600">
                    {ingredient}
                  </span>
                ))}
              </div>
              {product.calories && (
                <p className="mt-3 text-xs text-charcoal-400">
                  Approximately {product.calories} kcal per serving.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <ReviewsSection product={product} reviews={reviews} />
    </div>
  );
}

function ReviewsSection({ product, reviews }: { product: ProductDTO; reviews: Review[] }) {
  const { user } = useSession();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const data = await apiPost<{ message: string }>(`/api/products/${product.slug}/reviews`, {
        rating,
        comment,
      });
      toast.success(data.message);
      setSubmitted(true);
      setComment("");
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't submit your review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mt-14 border-t border-cream-200 pt-10" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="text-xl font-bold md:text-2xl">
        Reviews ({product.ratingCount})
      </h2>

      <div className="mt-6 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {reviews.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-cream-300 bg-cream-50 px-5 py-10 text-center text-sm text-charcoal-500">
              No reviews yet. Order it and be the first to weigh in.
            </p>
          ) : (
            <ul className="space-y-4">
              {reviews.map((review) => (
                <li key={review.id} className="rounded-2xl border border-cream-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-charcoal-900">{review.author}</p>
                      <p className="text-xs text-charcoal-400">{formatDate(review.createdAt)}</p>
                    </div>
                    <Rating value={review.rating} size={13} />
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-charcoal-600">{review.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="surface p-5">
            <h3 className="text-base font-bold">Write a review</h3>
            {!user ? (
              <p className="mt-2 text-sm text-charcoal-500">
                <a href="/login" className="font-semibold text-chai-700 hover:underline">Login</a>{" "}
                to review items you&apos;ve ordered.
              </p>
            ) : submitted ? (
              <p className="mt-2 text-sm text-circuit-600">
                Thanks! Your review is awaiting approval.
              </p>
            ) : (
              <form onSubmit={submit} className="mt-4 space-y-4">
                <fieldset>
                  <legend className="label">Your rating</legend>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                        aria-pressed={rating === value}
                        className="rounded p-0.5"
                      >
                        <Star
                          className={cn(
                            "h-6 w-6 transition",
                            value <= rating ? "fill-chai-400 text-chai-400" : "fill-cream-200 text-cream-300",
                          )}
                        />
                      </button>
                    ))}
                  </div>
                </fieldset>

                <Textarea
                  label="Your review"
                  name="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="How was it?"
                  required
                  minLength={5}
                  maxLength={600}
                  rows={4}
                />

                <Button type="submit" loading={submitting} className="w-full">
                  Submit review
                </Button>
                <p className="text-[11px] leading-snug text-charcoal-400">
                  You can review an item once it has been delivered to you.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
