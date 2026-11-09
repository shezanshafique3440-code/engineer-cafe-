import { z } from "zod";
import { handle, json, parseBody, HttpError } from "@/server/api";
import {
  cleanupPreview,
  demoStatus,
  queueDemo,
  requireOwner,
  RESET_PHRASE,
} from "@/server/demo-data";
export const dynamic = "force-dynamic";
export const GET = handle(async (request: Request) => {
  await requireOwner();
  const response = json(
    new URL(request.url).searchParams.get("preview") === "1"
      ? await cleanupPreview()
      : await demoStatus(),
  );
  response.headers.set("Cache-Control", "no-store");
  return response;
});
export const POST = handle(async (request: Request) => {
  const actor = await requireOwner();
  // Reject cross-site form submissions even if browser cookie policies change.
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== new URL(request.url).origin &&
    origin !== process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "")
  )
    throw new HttpError(403, "Open this page from the cafe website.");
  const body = await parseBody(
    request,
    z.object({
      action: z.enum(["SEED", "CLEANUP"]),
      confirmation: z.string(),
      previewHash: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
    }),
  );
  if (
    body.confirmation !==
    (body.action === "CLEANUP" ? RESET_PHRASE : "LOAD DEMO DATA")
  )
    throw new HttpError(422, "Type the exact confirmation shown on this page.");
  if (body.action === "CLEANUP" && !body.previewHash)
    throw new HttpError(422, "Review a fresh cleanup preview first.");
  const job = await queueDemo(body.action, actor, body.previewHash);
  return json({ id: job.id, status: job.status }, 202);
});
