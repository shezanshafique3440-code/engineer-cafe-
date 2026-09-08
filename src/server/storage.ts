import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { HttpError } from "./api";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"] as const;

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export type StorageAdapter = {
  name: string;
  upload(file: { buffer: Buffer; mime: string; originalName: string }): Promise<{ url: string }>;
};

/**
 * Development / single-VPS adapter. Files land in `public/uploads` which is
 * git-ignored — uploaded images are never committed into the frontend source.
 */
const localAdapter: StorageAdapter = {
  name: "local",
  async upload({ buffer, mime }) {
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const filename = `${randomUUID()}.${EXTENSION[mime] ?? "jpg"}`;
    await writeFile(path.join(dir, filename), buffer);
    return { url: `/uploads/${filename}` };
  },
};

/**
 * Cloudinary adapter — unsigned-free, uses the REST upload endpoint with a
 * signed timestamp. Enabled by setting UPLOAD_PROVIDER=cloudinary.
 */
const cloudinaryAdapter: StorageAdapter = {
  name: "cloudinary",
  async upload({ buffer, mime, originalName }) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      throw new HttpError(500, "Image uploads are not configured. Please contact support.");
    }

    const { createHash } = await import("node:crypto");
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "engineer-cafe";
    const signature = createHash("sha1")
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest("hex");

    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(buffer)], { type: mime }), originalName);
    form.append("api_key", apiKey);
    form.append("timestamp", String(timestamp));
    form.append("folder", folder);
    form.append("signature", signature);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) throw new HttpError(502, "Image upload failed. Please try again.");
    const result = (await response.json()) as { secure_url?: string };
    if (!result.secure_url) throw new HttpError(502, "Image upload failed. Please try again.");
    return { url: result.secure_url };
  },
};

/**
 * S3-compatible adapter (AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces).
 * Signs requests with SigV4 so no extra SDK dependency is needed.
 */
const s3Adapter: StorageAdapter = {
  name: "s3",
  async upload({ buffer, mime }) {
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const region = process.env.S3_REGION ?? "auto";
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const publicUrl = process.env.S3_PUBLIC_URL;

    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      throw new HttpError(500, "Image uploads are not configured. Please contact support.");
    }

    const { createHash, createHmac } = await import("node:crypto");
    const key = `engineer-cafe/${randomUUID()}.${EXTENSION[mime] ?? "jpg"}`;
    const host = new URL(endpoint).host;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash("sha256").update(buffer).digest("hex");

    const canonicalRequest = [
      "PUT",
      `/${bucket}/${key}`,
      "",
      `content-type:${mime}`,
      `host:${host}`,
      `x-amz-content-sha256:${payloadHash}`,
      `x-amz-date:${amzDate}`,
      "",
      "content-type;host;x-amz-content-sha256;x-amz-date",
      payloadHash,
    ].join("\n");

    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const hmac = (k: Buffer | string, d: string) => createHmac("sha256", k).update(d).digest();
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), "s3"), "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    const response = await fetch(`${endpoint.replace(/\/$/, "")}/${bucket}/${key}`, {
      method: "PUT",
      headers: {
        "Content-Type": mime,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date, Signature=${signature}`,
      },
      body: new Uint8Array(buffer),
    });
    if (!response.ok) throw new HttpError(502, "Image upload failed. Please try again.");

    const base = publicUrl?.replace(/\/$/, "") ?? `${endpoint.replace(/\/$/, "")}/${bucket}`;
    return { url: `${base}/${key}` };
  },
};

const adapters: Record<string, StorageAdapter> = {
  local: localAdapter,
  cloudinary: cloudinaryAdapter,
  s3: s3Adapter,
};

export function storage(): StorageAdapter {
  return adapters[env.uploadProvider] ?? localAdapter;
}
