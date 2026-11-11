"use client";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui";

export function CompleteReportDownload({
  from,
  to,
}: {
  from: string;
  to: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  async function download() {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const response = await fetch(
        "/api/admin/complete-report?" + new URLSearchParams({ from, to }),
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
      link.download = `Cafe-Complete-Report-${from}-to-${to}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDone(`Report downloaded for ${from} to ${to}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report download failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="surface space-y-2 p-4"
      aria-label="Complete Excel report"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">All business details in one Excel file</h2>
          <p className="mt-1 text-sm text-charcoal-500">
            Uses the From / To dates above. Includes sales, purchases, stock,
            staff, shifts, riders and accounts in separate sheets.
          </p>
        </div>
        <Button
          onClick={() => void download()}
          loading={busy}
          disabled={!from || !to || from > to}
        >
          <Download className="h-4 w-4" />
          {busy ? "Preparing Excel…" : "Download Complete Report"}
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
