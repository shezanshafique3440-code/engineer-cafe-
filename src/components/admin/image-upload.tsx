"use client";

import Image from "next/image";
import { useRef, useState } from "react";
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
}: {
  value: string;
  onChange: (url: string) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const data = await apiPost<{ url: string; provider: string }>("/api/admin/upload", body);
      onChange(data.url);
      toast.success(`Image uploaded (${data.provider})`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <span className="label">{label}</span>

      {value ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-cream-200 bg-cream-100">
          <Image src={value} alt="Product preview" fill sizes="400px" className="object-cover" unoptimized={value.startsWith("/uploads")} />
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Remove image"
            className="absolute right-2 top-2 rounded-full bg-white/95 p-2 text-charcoal-700 shadow-soft transition hover:bg-white"
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
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <div className="mt-2">
        {showUrl ? (
          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…"
            className="field text-xs"
            aria-label="Image URL"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowUrl(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-chai-700 hover:underline"
          >
            <Link2 className="h-3 w-3" aria-hidden /> Or paste an image URL
          </button>
        )}
      </div>
    </div>
  );
}
