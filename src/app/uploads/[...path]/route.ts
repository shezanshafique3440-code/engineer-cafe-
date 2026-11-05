import { readLocalUpload } from "@/server/local-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** New local images must be available immediately, including after next start. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const image = await readLocalUpload(path);
  if (!image)
    return new Response("Image not found.", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });

  const headers = {
    "Content-Type": image.mime,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "public, max-age=0, must-revalidate",
    ETag: image.etag,
  };
  const matches = request.headers
    .get("if-none-match")
    ?.split(",")
    .map((tag) => tag.trim());
  if (
    matches?.some(
      (tag) => tag === "*" || tag.replace(/^W\//, "") === image.etag,
    )
  )
    return new Response(null, { status: 304, headers });

  return new Response(new Uint8Array(image.buffer), { headers });
}
