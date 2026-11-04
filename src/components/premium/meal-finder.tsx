"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Sparkles, Users, Wallet, ShoppingBag, Check } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api-client";
import { planMeals, type MealPreferences } from "@/lib/menu-planner";
import { useCart } from "@/context/cart-context";
import { useMoney, useSettings } from "@/context/settings-context";
import { Button, Input, Select, Checkbox, ErrorState } from "@/components/ui";
import type { ProductDTO } from "@/lib/types";
export function MealFinder() {
  const [catalog, setCatalog] = useState<ProductDTO[] | null>(null),
    [error, setError] = useState(false),
    [refresh, setRefresh] = useState(0),
    [truncated, setTruncated] = useState(false),
    [added, setAdded] = useState("");
  const [preferences, setPreferences] = useState<MealPreferences>({
    budget: 600,
    people: 1,
    vegetarian: false,
    mild: false,
    includeDrink: true,
  });
  const { addItem, lines } = useCart();
  const money = useMoney();
  const settings = useSettings();
  useEffect(() => {
    let active = true;
    setError(false);
    apiGet<{ products: ProductDTO[]; truncated: boolean }>("/api/meal-catalog")
      .then((d) => {
        if (active) {
          setCatalog(d.products);
          setTruncated(d.truncated);
        }
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  const meals = useMemo(
    () =>
      planMeals(catalog ?? [], {
        ...preferences,
        minimum: settings.minOrderAmount,
      }),
    [catalog, preferences, settings.minOrderAmount],
  );
  const add = (meal: (typeof meals)[number]) => {
    for (const row of meal.lines) {
      const existing = lines
        .filter((l) => l.productId === row.product.id)
        .reduce((sum, l) => sum + l.quantity, 0);
      if (
        existing + row.quantity > 50 ||
        (row.product.stock !== null &&
          existing + row.quantity > row.product.stock)
      ) {
        toast.error(
          `Check the quantity of ${row.product.name} already in your cart.`,
        );
        return;
      }
    }
    for (const row of meal.lines)
      addItem(row.product, {
        quantity: row.quantity,
        addons: row.addons,
        silent: true,
      });
    setAdded(meal.key);
    toast.success("Meal added. Review live pricing in your cart.");
  };
  return (
    <div className="container py-8 md:py-14">
      <div className="max-w-2xl">
        <p className="eyebrow">Your next chai break, figured out</p>
        <h1 className="mt-3 text-3xl font-extrabold sm:text-5xl">
          Good taste. Your budget.
        </h1>
        <p className="mt-4 text-charcoal-600">
          Tell us your group size and food budget. We’ll match a main and
          optional drink per person from the live menu, including required
          options.
        </p>
      </div>
      <div className="surface mt-7 grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
        <Input
          label="Total food budget (PKR)"
          type="number"
          inputMode="numeric"
          min={1}
          max={100000}
          value={preferences.budget || ""}
          onChange={(e) =>
            setPreferences((p) => ({ ...p, budget: Number(e.target.value) }))
          }
        />
        <Select
          label="People"
          value={preferences.people}
          onChange={(e) =>
            setPreferences((p) => ({ ...p, people: Number(e.target.value) }))
          }
        >
          {Array.from({ length: 8 }, (_, n) => (
            <option key={n + 1} value={n + 1}>
              {n + 1} {n ? "people" : "person"}
            </option>
          ))}
        </Select>
        <div className="flex items-center gap-3 rounded-xl bg-chai-50 p-3 text-sm text-chai-800">
          <Wallet className="h-5 w-5 shrink-0" />
          <span>
            {money(Math.floor(preferences.budget / preferences.people) || 0)}{" "}
            per person
          </span>
        </div>
        <Checkbox
          label="Vegetarian options"
          checked={preferences.vegetarian}
          onChange={(e) =>
            setPreferences((p) => ({ ...p, vegetarian: e.target.checked }))
          }
        />
        <Checkbox
          label="Keep it mild"
          description="Excludes medium and hot items."
          checked={preferences.mild}
          onChange={(e) =>
            setPreferences((p) => ({ ...p, mild: e.target.checked }))
          }
        />
        <Checkbox
          label="Add a drink per person"
          checked={preferences.includeDrink}
          onChange={(e) =>
            setPreferences((p) => ({ ...p, includeDrink: e.target.checked }))
          }
        />
      </div>
      <p className="mt-3 text-xs text-charcoal-500">
        Cafe minimum: {money(settings.minOrderAmount)} before discounts. Food
        estimate only. Delivery, tax and coupons are recalculated at checkout.
        Dietary labels come from the cafe; contact staff about allergies.
      </p>
      {truncated && (
        <p className="mt-3 text-sm text-amber-700">
          Suggestions use the first 200 available menu products.
        </p>
      )}
      {error ? (
        <div className="mt-8">
          <ErrorState
            title="The live menu could not load."
            onRetry={() => setRefresh((v) => v + 1)}
          />
        </div>
      ) : !catalog ? (
        <p role="status" className="py-14 text-center text-charcoal-500">
          Finding your next favourite…
        </p>
      ) : !meals.length ? (
        <div className="surface mt-8 p-8 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-chai-500" />
          <h2 className="mt-4 text-xl font-bold">
            Let’s try another combination.
          </h2>
          <p className="mt-2 text-sm text-charcoal-500">
            No complete meal fits these choices. Raise your budget, remove the
            drink or change the dietary filters.
          </p>
          <Link href="/menu" className="btn-secondary mt-5">
            Browse the full menu
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {meals.map((meal, index) => (
            <article
              key={meal.key}
              className="surface flex min-w-0 flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 border-b border-cream-200 bg-cream-100 px-4 py-3">
                <span className="text-xs font-bold uppercase tracking-wide text-chai-700">
                  {index === 0 ? "Popular match" : `Your option ${index + 1}`}
                </span>
                <span className="flex items-center gap-1 text-xs text-charcoal-500">
                  <Users className="h-3.5 w-3.5" />
                  {preferences.people}
                </span>
              </div>
              <ul className="flex-1 space-y-4 p-4">
                {meal.lines.map((row) => (
                  <li key={row.product.id} className="flex gap-3">
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-cream-100">
                      {row.product.image && (
                        <Image
                          src={row.product.image}
                          alt=""
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold">
                        {row.quantity} × {row.product.name}
                      </p>
                      <p className="mt-1 text-xs text-charcoal-500">
                        {row.addons.length
                          ? row.addons.map((a) => a.name).join(" · ")
                          : "Standard preparation"}
                      </p>
                      <Link
                        className="mt-1 inline-block text-xs font-semibold text-chai-700 underline"
                        href={`/menu/${row.product.category.slug}/${row.product.slug}`}
                      >
                        View & customise
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-cream-200 p-4">
                <div className="mb-3 flex justify-between gap-3">
                  <span className="text-xl font-bold">{money(meal.total)}</span>
                  <span className="self-center text-xs text-charcoal-500">
                    {money(Math.max(0, preferences.budget - meal.total))} under
                    budget
                  </span>
                </div>
                <Button className="w-full" onClick={() => add(meal)}>
                  {added === meal.key ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <ShoppingBag className="h-4 w-4" />
                  )}
                  {added === meal.key ? "Added · add again" : "Add this meal"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="mt-7 text-center text-xs text-charcoal-500">
        Matches use availability, your preferences and menu popularity. This is
        a rules-based planner, not a nutrition or allergy guarantee.
      </p>
    </div>
  );
}
