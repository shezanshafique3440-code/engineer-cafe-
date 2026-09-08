import { handle, json, requireAdmin, badRequest } from "@/server/api";
import { rateLimit } from "@/server/rate-limit";
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, storage } from "@/server/storage";

export const POST = handle(async (request: Request) => {
  await requireAdmin();
  rateLimit(request, "upload", 30, 60_000);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw badRequest("Choose an image to upload.");

  if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
    throw badRequest("Only JPG, PNG, WebP and AVIF images are allowed.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw badRequest(`Image must be smaller than ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const adapter = storage();
  const { url } = await adapter.upload({ buffer, mime: file.type, originalName: file.name });

  return json({ url, provider: adapter.name }, 201);
});
