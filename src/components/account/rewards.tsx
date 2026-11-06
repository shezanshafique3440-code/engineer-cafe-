"use client";
import { useEffect, useState } from "react";
import { Gift } from "lucide-react";
import { apiGet } from "@/lib/api-client";
import { useMoney } from "@/context/settings-context";
import { ErrorState } from "@/components/ui";
import { T, useLanguage } from "@/context/language-context";
type Rewards = {
  balance: number;
  entries: { id: string; kind: string; points: number; createdAt: string }[];
  enabled: boolean;
  earnEvery: number;
  rewardPoints: number;
  rewardValue: number;
};
export function Rewards() {
  const [data, setData] = useState<Rewards | null>(null),
    [error, setError] = useState(false);
  const money = useMoney();
  const { t } = useLanguage();
  const load = () =>
    apiGet<Rewards>("/api/loyalty")
      .then((d) => {
        setData(d);
        setError(false);
      })
      .catch(() => setError(true));
  useEffect(() => {
    void load();
  }, []);
  return (
    <div>
      <h1 className="text-3xl font-bold">
        <T text="Cafe rewards" />
      </h1>
      {error ? (
        <ErrorState onRetry={() => void load()} />
      ) : !data ? (
        <p role="status">
          <T text="Loading…" />
        </p>
      ) : (
        <>
          <div className="surface mt-5 p-6">
            <Gift className="h-8 w-8 text-chai-600" />
            <p className="mt-3 text-4xl font-bold">
              {data.balance}{" "}
              <span className="text-base">
                <T text="points" />
              </span>
            </p>
            <p className="mt-3 text-sm">
              {t("Earn 1 point for every")} {money(data.earnEvery)}.{" "}
              {data.rewardPoints} {t("points unlock")} {money(data.rewardValue)}{" "}
              {t("off your next order")}.{" "}
              <T text="Points arrive after handover. Cancelled orders are reversed." />
            </p>
            {!data.enabled && (
              <p className="mt-3">
                <T text="Rewards are paused by the cafe." />
              </p>
            )}
            <progress
              className="mt-4 w-full accent-chai-600"
              value={Math.max(0, Math.min(data.balance, data.rewardPoints))}
              max={data.rewardPoints}
            />
            <p className="mt-2 text-sm">
              {data.balance >= data.rewardPoints
                ? t("A reward is ready to use at checkout.")
                : `${Math.max(0, data.rewardPoints - data.balance)} ${t("points to your next reward")}`}
            </p>
          </div>
          <h2 className="mt-7 text-lg font-bold">
            <T text="Points history" />
          </h2>
          {!data.entries.length && (
            <p className="mt-3 text-sm">
              <T text="Your first completed order starts your rewards journey." />
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {data.entries.map((e) => (
              <li
                key={e.id}
                className="surface flex justify-between gap-3 p-4 text-sm"
              >
                <span>
                  {t(
                    (
                      {
                        EARN: "Order completed",
                        REDEEM: "Reward redeemed",
                        RETURN: "Reward returned",
                        REVERSE: "Order cancelled",
                      } as Record<string, string>
                    )[e.kind] ?? e.kind,
                  )}{" "}
                  · {new Date(e.createdAt).toLocaleDateString("en-PK")}
                </span>
                <strong>
                  {e.points > 0 ? "+" : ""}
                  {e.points}
                </strong>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
