"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPut } from "@/lib/api-client";
import { useSession } from "@/context/session-context";
import { AppTools } from "@/components/pwa/app-tools";
import { Button, Input, Checkbox, ErrorState } from "@/components/ui";
import type { ScheduleRules } from "@/lib/experience";
type Rules = ScheduleRules & {
  loyaltyEnabled: boolean;
  loyaltyEarnEvery: number;
  loyaltyRewardPoints: number;
  loyaltyRewardValue: number;
};
export function ExperienceSettings() {
  const { user } = useSession();
  const [data, setData] = useState<Rules | null>(null),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  const load = () =>
    apiGet<{ settings: Rules }>("/api/admin/experience")
      .then((d) => {
        setData(d.settings);
        setError(false);
      })
      .catch(() => setError(true));
  useEffect(() => {
    void load();
  }, []);
  const set = (key: keyof Rules, value: number | boolean) =>
    setData((v) => (v ? { ...v, [key]: value } : v));
  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold">Rewards & scheduling</h1>
      <p className="mt-2 text-sm text-charcoal-500">
        Control repeat-customer rewards and order-ahead availability.
      </p>
      <section className="surface my-5 p-5">
        <h2 className="mb-3 text-lg font-bold">Cafe app & notifications</h2>
        <AppTools admin />
      </section>
      {error ? (
        <ErrorState onRetry={() => void load()} />
      ) : !data ? (
        <p>Loading…</p>
      ) : (
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const d = await apiPut<{ settings: Rules }>(
                "/api/admin/experience",
                data,
              );
              setData(d.settings);
              toast.success("Reward and scheduling rules saved.");
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Could not save rules",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset
            disabled={user?.role !== "ADMIN" || busy}
            className="space-y-5"
          >
            <section className="surface p-5">
              <h2 className="mb-4 text-lg font-bold">Loyalty rewards</h2>
              <Checkbox
                label="Enable customer rewards"
                checked={data.loyaltyEnabled}
                onChange={(e) => set("loyaltyEnabled", e.target.checked)}
              />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {(
                  [
                    ["loyaltyEarnEvery", "Spend per point (Rs.)"],
                    ["loyaltyRewardPoints", "Points to redeem"],
                    ["loyaltyRewardValue", "Reward value (Rs.)"],
                  ] as const
                ).map(([key, label]) => (
                  <Input
                    key={key}
                    required
                    label={label}
                    type="number"
                    min={1}
                    max={key === "loyaltyRewardPoints" ? 100000 : 10000}
                    value={data[key]}
                    onChange={(e) => set(key, Number(e.target.value))}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-charcoal-500">
                Points are awarded on handover for the items paid for, after
                discounts, excluding delivery and tax. Each reward is one
                redemption per order. Rules apply to new orders; existing
                tickets keep their agreed reward.
              </p>
            </section>
            <section className="surface p-5">
              <h2 className="mb-4 text-lg font-bold">
                Order ahead · Pakistan time
              </h2>
              <Checkbox
                label="Enable scheduled orders"
                checked={data.schedulingEnabled}
                onChange={(e) => set("schedulingEnabled", e.target.checked)}
              />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Input
                  required
                  label="Minimum notice (minutes)"
                  type="number"
                  min={15}
                  max={1440}
                  value={data.scheduleLeadMinutes}
                  onChange={(e) =>
                    set("scheduleLeadMinutes", Number(e.target.value))
                  }
                />
                <Input
                  required
                  label="Maximum days ahead"
                  type="number"
                  min={1}
                  max={30}
                  value={data.scheduleDaysAhead}
                  onChange={(e) =>
                    set("scheduleDaysAhead", Number(e.target.value))
                  }
                />
                {(["scheduleOpenMinute", "scheduleCloseMinute"] as const).map(
                  (key) => (
                    <Input
                      required
                      key={key}
                      label={
                        key === "scheduleOpenMinute"
                          ? "First available time"
                          : "Last available time (exclusive)"
                      }
                      type="time"
                      value={`${String(Math.floor(data[key] / 60)).padStart(2, "0")}:${String(data[key] % 60).padStart(2, "0")}`}
                      onChange={(e) => {
                        const [h, m] = e.target.value.split(":").map(Number);
                        set(key, h * 60 + m);
                      }}
                    />
                  ),
                )}
              </div>
              <p className="mt-3 text-xs text-charcoal-500">
                Closing earlier than opening means service continues past
                midnight. Matching times allow 24 hours. Kitchen preparation
                stays locked until the scheduled time is within its estimate.
              </p>
            </section>
            <Button type="submit" loading={busy}>
              Save rules
            </Button>
          </fieldset>
          {user?.role !== "ADMIN" && (
            <p className="text-sm">Only an admin can change these rules.</p>
          )}
        </form>
      )}
    </div>
  );
}
