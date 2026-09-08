"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/context/favorites-context";
import { ProductCard, ProductCardSkeleton } from "@/components/menu/product-card";
import { EmptyState } from "@/components/ui";
import type { ProductDTO } from "@/lib/types";

export function FavoritesView({ initialProducts }: { initialProducts: ProductDTO[] }) {
  const { ids, loading } = useFavorites();

  // Filter against the live favorites set so un-hearting removes it instantly.
  const products = initialProducts.filter((product) => ids.has(product.id));

  return (
    <div>
      <h1 className="text-2xl font-extrabold md:text-3xl">My Favorites</h1>
      <p className="mt-1.5 text-sm text-charcoal-500">
        Everything you&apos;ve saved, one tap from the cart.
      </p>

      <div className="mt-6">
        {loading && initialProducts.length === 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Heart className="h-6 w-6" />}
            title="No favorites yet."
            description="Tap the heart on any item to save it here."
            actionLabel="Discover Menu"
            actionHref="/menu"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
            {products.map((product, index) => (
              <ProductCard key={product.id} product={product} index={index} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
