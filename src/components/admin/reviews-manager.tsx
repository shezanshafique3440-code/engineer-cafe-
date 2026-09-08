"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, EyeOff, Trash2 } from "lucide-react";
import { apiGet, apiPatch, apiDelete, ApiError } from "@/lib/api-client";
import { PageHeader, TableSkeleton } from "./ui";
import { Button, Rating, ErrorState, Badge, EmptyState } from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";

type Review = {
  id: string;
  rating: number;
  comment: string;
  status: "PENDING" | "APPROVED" | "HIDDEN";
  createdAt: string;
  author: string;
  authorEmail: string;
  productName: string;
  productSlug: string;
};

const FILTERS = ["PENDING", "APPROVED", "HIDDEN", "ALL"] as const;

export function ReviewsManager() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("PENDING");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await apiGet<{ reviews: Review[] }>(`/api/admin/reviews?status=${status}`);
      setReviews(data.reviews);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const setReviewStatus = async (review: Review, next: Review["status"]) => {
    setUpdating(review.id);
    try {
      await apiPatch(`/api/admin/reviews/${review.id}`, { status: next });
      toast.success(next === "APPROVED" ? "Review approved" : "Review hidden");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Couldn't update this review.");
    } finally {
      setUpdating(null);
    }
  };

  const remove = async (review: Review) => {
    if (!window.confirm("Delete this review permanently?")) return;
    setUpdating(review.id);
    try {
      await apiDelete(`/api/admin/reviews/${review.id}`);
      toast.success("Review deleted");
      await load();
    } catch {
      toast.error("Couldn't delete this review.");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div>
      <PageHeader title="Reviews" description="Approve, hide or delete customer reviews." />

      <div className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setStatus(option)}
            aria-pressed={status === option}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
              status === option
                ? "border-chai-500 bg-chai-50 text-chai-700"
                : "border-cream-300 bg-white text-charcoal-600 hover:border-chai-300",
            )}
          >
            {option === "ALL" ? "All" : option.charAt(0) + option.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState title="Unable to load reviews." onRetry={load} />
      ) : loading && reviews.length === 0 ? (
        <TableSkeleton rows={4} cols={3} />
      ) : reviews.length === 0 ? (
        <EmptyState title="Nothing to moderate." description="No reviews match this filter." />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id} className="surface p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-charcoal-900">{review.author}</p>
                  <p className="truncate text-xs text-charcoal-400">{review.authorEmail}</p>
                  <p className="mt-1 text-xs text-charcoal-500">
                    on <span className="font-semibold text-chai-700">{review.productName}</span> ·{" "}
                    {formatDate(review.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Rating value={review.rating} size={13} />
                  <Badge
                    tone={
                      review.status === "APPROVED" ? "green" : review.status === "HIDDEN" ? "red" : "chai"
                    }
                  >
                    {review.status}
                  </Badge>
                </div>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-charcoal-600">{review.comment}</p>

              <div className="mt-4 flex flex-wrap gap-2 border-t border-cream-200 pt-4">
                {review.status !== "APPROVED" && (
                  <Button size="sm" loading={updating === review.id} onClick={() => void setReviewStatus(review, "APPROVED")}>
                    <Check className="h-3.5 w-3.5" aria-hidden /> Approve
                  </Button>
                )}
                {review.status !== "HIDDEN" && (
                  <Button size="sm" variant="secondary" loading={updating === review.id} onClick={() => void setReviewStatus(review, "HIDDEN")}>
                    <EyeOff className="h-3.5 w-3.5" aria-hidden /> Hide
                  </Button>
                )}
                <Button size="sm" variant="danger" loading={updating === review.id} onClick={() => void remove(review)}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
