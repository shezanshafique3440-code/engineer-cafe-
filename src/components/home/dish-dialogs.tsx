"use client";

import Image from "next/image";
import { useState } from "react";
import { ArrowRight, Search, UtensilsCrossed } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useMoney } from "@/context/settings-context";
import { dishExperience } from "@/lib/dish-experience";
import { IngredientSprite } from "./dish-performance";
import type { ProductDTO } from "@/lib/types";

export function DishIngredients({
  product,
  open,
  onClose,
}: {
  product: ProductDTO;
  open: boolean;
  onClose: () => void;
}) {
  const profile = dishExperience(product);
  return (
    <Modal open={open} onClose={onClose} title={`${product.name} ingredients`}>
      <p className="mb-5 text-sm text-charcoal-500">
        From this item’s current menu recipe.
      </p>
      {profile.ingredients.length ? (
        <ul className="dish-full-recipe">
          {profile.ingredients.map((ingredient) => (
            <li key={ingredient.label}>
              <IngredientSprite ingredient={ingredient} />
              <span>{ingredient.label}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-cream-100 p-4 text-sm text-charcoal-600">
          The cafe hasn’t added an ingredient list for this item yet.
        </p>
      )}
    </Modal>
  );
}

export function DishChooser({
  products,
  open,
  onClose,
  onSelect,
}: {
  products: ProductDTO[];
  open: boolean;
  onClose: () => void;
  onSelect: (product: ProductDTO) => void;
}) {
  const [query, setQuery] = useState("");
  const money = useMoney();
  const term = query.trim().toLocaleLowerCase();
  const shown = products.filter((p) =>
    `${p.name} ${p.urduName ?? ""} ${p.category.name} ${p.ingredients.join(" ")}`
      .toLocaleLowerCase()
      .includes(term),
  );
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose your food experience"
      size="lg"
    >
      <p className="mb-4 text-sm text-charcoal-500">
        Choose any available dish to bring its photo and ingredients to the
        stage.
      </p>
      <label className="dish-chooser-search">
        <Search size={17} aria-hidden />
        <span className="sr-only">Find a menu item</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search dishes or ingredients…"
        />
      </label>
      <p role="status" className="my-3 text-xs text-charcoal-500">
        {shown.length} available {shown.length === 1 ? "dish" : "dishes"}
      </p>
      <div className="dish-chooser-grid">
        {shown.map((product) => (
          <button
            type="button"
            key={product.id}
            className="dish-chooser-item"
            onClick={() => onSelect(product)}
            aria-label={`Experience ${product.name}`}
          >
            <span className="dish-chooser-photo">
              {product.image ? (
                <Image
                  src={product.image}
                  alt=""
                  width={100}
                  height={100}
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <UtensilsCrossed size={24} aria-hidden />
              )}
            </span>
            <span className="dish-chooser-copy">
              <strong>{product.name}</strong>
              <small>{product.category.name}</small>
              <span>{money(product.discountPrice ?? product.price)}</span>
            </span>
            <ArrowRight size={16} aria-hidden />
          </button>
        ))}
      </div>
      {!shown.length && (
        <p className="py-7 text-center text-sm text-charcoal-500">
          No matching dishes. Try a different name or ingredient.
        </p>
      )}
    </Modal>
  );
}
