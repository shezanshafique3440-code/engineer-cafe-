"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { REPORT_MODULES, findReportModule } from "@/lib/report-modules";
import { Button, Select } from "@/components/ui";

export function CompleteReportDownload({
  from,
  to,
  section,
}: {
  from: string;
  to: string;
  section: string;
}) {
  const [selected, setSelected] = useState<string>(
    REPORT_MODULES.find((m) =>
      (m.sections as readonly string[]).includes(section),
    )?.id ?? "financial",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  async function download(all = false) {
    const report = findReportModule(selected)!;
    setBusy(true);
    setError("");
    setDone("");
    try {
      const response = await fetch(
        "/api/admin/complete-report?" +
          new URLSearchParams({
            from,
            to,
            ...(all ? { format: "zip" } : { module: selected }),
          }),
        { cache: "no-store" },
      );
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(
          result?.error || "The report could not be downloaded. Please retry.",
        );
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${all ? "Cafe-All-Reports" : report.file}-${from}-to-${to}.${all ? "zip" : "xlsx"}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDone(
        `${all ? "All reports ZIP" : report.label} downloaded for ${from} to ${to}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report download failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="surface space-y-2 p-4" aria-label="Excel reports">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Download business reports</h2>
          <p className="mt-1 text-sm text-charcoal-500">
            Choose a report for its own detailed Excel file. Download All gives
            you every report as separate files inside one ZIP. Uses the From /
            To dates above.
          </p>
        </div>
        <Button
          onClick={() => void download(true)}
          loading={busy}
          disabled={!from || !to || from > to}
        >
          <Download className="h-4 w-4" /> Download All (ZIP)
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Report"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={busy}
        >
          {REPORT_MODULES.map((report) => (
            <option key={report.id} value={report.id}>
              {report.label}
            </option>
          ))}
        </Select>
        <Button
          variant="secondary"
          onClick={() => void download()}
          loading={busy}
          disabled={!from || !to || from > to}
        >
          <Download className="h-4 w-4" /> Download Excel
        </Button>
      </div>
      <p className="text-xs text-charcoal-500">
        Sync pending offline bills first. Current stock and staff lists are
        labelled separately from dated transactions.
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {done && (
        <p role="status" className="text-sm text-green-700">
          {done}
        </p>
      )}
    </section>
  );
}
