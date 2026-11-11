"use client";
import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/api-client";
import { Button, ErrorState } from "@/components/ui";
type Status = {
  database: string;
  notificationFailures: number;
  demoFailures: number;
  backup: { completedAt: string; offsite: boolean } | null;
  emailRecovery: boolean;
  onlineGateway: string;
  checkedAt: string;
};
export function SystemHealth() {
  const [data, setData] = useState<Status | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      setData(await apiGet<Status>("/api/admin/system"));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Status unavailable");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">System health</h1>
          <p className="mt-2 text-sm text-charcoal-600">
            Owner checks for database, background jobs and backup status.
          </p>
        </div>
        <Button variant="secondary" onClick={() => void load()}>
          Refresh status
        </Button>
      </div>
      {error && (
        <ErrorState
          title="Could not check status"
          description={error}
          onRetry={() => void load()}
        />
      )}
      {!data && !error && <p role="status">Checking system…</p>}
      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["Database", data.database],
            [
              "Notifications needing attention",
              String(data.notificationFailures),
            ],
            ["Failed demo jobs", String(data.demoFailures)],
            [
              "Last verified backup",
              data.backup
                ? new Date(data.backup.completedAt).toLocaleString()
                : "Not verified on this server",
            ],
            [
              "Offsite backup",
              data.backup?.offsite
                ? "Encrypted copy transferred"
                : "Not verified",
            ],
            [
              "Password recovery email",
              data.emailRecovery
                ? "Configured — verify email delivery before handover"
                : "Not configured",
            ],
            [
              "Online payment gateway",
              data.onlineGateway + " — cash payments remain available",
            ],
            ["Last checked", new Date(data.checkedAt).toLocaleString()],
          ].map(([label, value]) => (
            <section className="surface p-5" key={label}>
              <h2 className="text-sm font-semibold text-charcoal-500">
                {label}
              </h2>
              <p className="mt-2 text-lg font-bold">{value}</p>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
