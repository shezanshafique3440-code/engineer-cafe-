import {
  handle,
  requireAdmin,
  forbidden,
  HttpError,
  badRequest,
} from "@/server/api";
import {
  completeReport,
  allReportFiles,
  reportBounds,
} from "@/server/reports/complete-report";

import { findReportModule } from "@/lib/report-modules";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
let exporting = false;
export const GET = handle(async (request: Request) => {
  const actor = await requireAdmin();
  if (actor.role !== "ADMIN")
    throw forbidden(
      "Only the cafe owner/admin can download the complete business report.",
    );
  const url = new URL(request.url);
  const bounds = reportBounds(url);
  const moduleId = url.searchParams.get("module");
  const report = moduleId ? findReportModule(moduleId) : undefined;
  const format = url.searchParams.get("format") ?? "xlsx";
  if (
    (moduleId !== null && !report) ||
    !["xlsx", "zip"].includes(format) ||
    (moduleId !== null && format === "zip")
  )
    throw badRequest("Choose a valid report, or Download All as ZIP.");
  if (exporting)
    throw new HttpError(
      429,
      "Another complete report is being prepared. Please retry shortly.",
    );
  exporting = true;
  try {
    const buffer =
      format === "zip"
        ? await allReportFiles(bounds, actor.name)
        : await completeReport(bounds, actor.name, report?.id);
    const filename =
      format === "zip"
        ? "Cafe-All-Reports"
        : (report?.file ?? "Cafe-Complete-Report");
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          format === "zip"
            ? "application/zip"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}-${bounds.from}-to-${bounds.to}.${format}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } finally {
    exporting = false;
  }
});
