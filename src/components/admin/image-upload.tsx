"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, X, Loader2, Link2 } from "lucide-react";
import { apiPost, ApiError } from "@/lib/api-client";

/**
 * Uploads through the admin API, which routes to whichever storage adapter is
 * configured (local / Cloudinary / S3-compatible). A direct URL can also be
 * pasted, so images never have to live in the frontend source tree.
 */
export function ImageUpload({
  value,
  onChange,
  label = "Product image",
  fit = "cover",
  onUploadingChange,
  error,
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  fit?: "cover" | "contain";
  onUploadingChange?: (uploading: boolean) => void;
  error?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [previewFailed, setPreviewFailed] = useState(false);

  useEffect(() => setPreviewFailed(false), [value]);

  const upload = async (file: File) => {
    if (uploading) return;
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const data = await apiPost<{ url: string; provider: string }>(
        "/api/admin/upload",
        body,
      );
      onChange(data.url);
      toast.success("Image uploaded. Save your changes to publish it.");
    } catch (error) {
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div aria-busy={uploading}>
      <label className="label" htmlFor={inputId}>
        {label}
      </label>

      {value ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-cream-200 bg-cream-100">
          {previewFailed ? (
            <p
              role="alert"
              className="flex h-full items-center justify-center p-6 text-center text-sm text-charcoal-600"
            >
              Image could not be loaded. Try another file or image URL.
            </p>
          ) : (
            <Image
              src={value}
              alt={`${label} preview`}
              fill
              sizes="400px"
              className={
                fit === "contain" ? "object-contain p-3" : "object-cover"
              }
              unoptimized
              onError={() => setPreviewFailed(true)}
            />
          )}
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={uploading}
            aria-label="Remove image"
            className="absolute right-2 top-2 rounded-full bg-surface/95 p-2 text-charcoal-700 shadow-soft transition hover:bg-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cream-300 bg-cream-50 text-charcoal-400 transition hover:border-chai-400 hover:text-chai-600 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-6 w-6" aria-hidden />
          )}
          <span className="text-sm font-medium">
            {uploading ? "Uploading…" : "Click to upload an image"}
          </span>
          <span className="text-xs">JPG, PNG, WebP or AVIF · max 5 MB</span>
        </button>
      )}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      {value && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-chai-700 disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="h-4 w-4" aria-hidden />
          )}
          {uploading ? "Uploading…" : `Replace ${label.toLowerCase()}`}
        </button>
      )}

      <div className="mt-2">
        {showUrl ? (
          <input
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={uploading}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://… or /uploads/…"
            className="field text-xs"
            aria-label={`${label} URL`}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowUrl(true)}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-chai-700 hover:underline"
          >
            <Link2 className="h-3 w-3" aria-hidden /> Or paste an image URL
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
