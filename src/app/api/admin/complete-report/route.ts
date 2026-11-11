import { handle, requireAdmin, forbidden, HttpError } from "@/server/api";
import { completeReport, reportBounds } from "@/server/reports/complete-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
let exporting = false;
export const GET = handle(async (request: Request) => {
  const actor = await requireAdmin();
  if (actor.role !== "ADMIN")
    throw forbidden(
      "Only the cafe owner/admin can download the complete business report.",
    );
  const bounds = reportBounds(new URL(request.url));
  if (exporting)
    throw new HttpError(
      429,
      "Another complete report is being prepared. Please retry shortly.",
    );
  exporting = true;
  try {
    const buffer = await completeReport(bounds, actor.name);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Cafe-Complete-Report-${bounds.from}-to-${bounds.to}.xlsx"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } finally {
    exporting = false;
  }
});
