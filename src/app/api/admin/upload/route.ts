import sharp from "sharp";
import { handle, json, requireAdmin, badRequest, readBodyBytes } from "@/server/api";
import { rateLimit } from "@/server/rate-limit";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, storage } from "@/server/storage";

export const POST = handle(async (request: Request) => {
  await requireAdmin("catalog");
  rateLimit(request, "upload", 30, 60_000);
  const bytes = await readBodyBytes(request, MAX_UPLOAD_BYTES + 64 * 1024);
  const form = await new Response(bytes as BodyInit, { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Choose an image to upload.");
  if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) throw badRequest("Only JPG, PNG, WebP and AVIF images are allowed.");
  if (!file.size || file.size > MAX_UPLOAD_BYTES) throw badRequest(`Image must be smaller than ${MAX_UPLOAD_BYTES / 1048576} MB.`);
  let buffer: Buffer;
  try {
    const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 16_000_000, animated: false });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp", "avif", "heif"].includes(metadata.format || "") || (metadata.pages ?? 1) > 1) throw Error("Invalid image");
    buffer = await image.rotate().webp({ quality: 85 }).toBuffer();
    if (buffer.length > MAX_UPLOAD_BYTES) throw Error("Image is too large");
  } catch { throw badRequest("Upload a valid JPG, PNG, WebP or AVIF image up to 16 megapixels."); }
  const adapter = storage();
  const { url } = await adapter.upload({ buffer, mime: "image/webp", originalName: "image.webp" });
  return json({ url, provider: adapter.name }, 201);
});
