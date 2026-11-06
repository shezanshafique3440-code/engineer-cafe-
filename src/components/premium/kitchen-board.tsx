"use client";
import { pakistanTime } from "@/lib/experience";

import { useCallback, useEffect, useState } from "react";
import {
  Clock3,
  Maximize2,
  Pause,
  Play,
  RefreshCw,
  ChefHat,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch, ApiError } from "@/lib/api-client";
import { KITCHEN_LANES, kitchenNext, ticketAge } from "@/lib/kitchen";
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL } from "@/lib/constants";
import { useMoney } from "@/context/settings-context";
import { Button, Select } from "@/components/ui";
import { PageHeader } from "@/components/admin/ui";
import { cn } from "@/lib/utils";
import type { OrderDTO } from "@/server/orders";

type Ticket = OrderDTO & { version: string };
type Board = { tickets: Ticket[]; total: number; fetchedAt: string };
export function KitchenBoard() {
  const [data, setData] = useState<Board | null>(null);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const [type, setType] = useState("ALL");
  const [lane, setLane] = useState<string>("PENDING");
  const [now, setNow] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const money = useMoney();
  const load = useCallback(async () => {
    try {
      setData(await apiGet<Board>("/api/admin/kitchen"));
      setFailed(false);
    } catch {
      setFailed(true);
    }
    setNow(Date.now());
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => {
      setNow(Date.now());
      if (!paused && !document.hidden && !updating) void load();
    }, 15_000);
    return () => clearInterval(timer);
  }, [load, paused, updating]);
  const advance = async (ticket: Ticket) => {
    const status = kitchenNext(ticket.status, ticket.orderType);
    if (!status) return;
    if (
      status === "DELIVERED" &&
      !window.confirm(
        ticket.paymentStatus !== "PAID" && ticket.paymentMethod !== "ONLINE"
          ? `Confirm #${ticket.orderNumber} has been handed over and ${money(ticket.total)} cash received?`
          : `Confirm #${ticket.orderNumber} has been handed over?`,
      )
    )
      return;
    setUpdating(ticket.id);
    try {
      await apiPatch("/api/admin/kitchen", {
        id: ticket.id,
        version: ticket.version,
        status,
      });
      toast.success(`#${ticket.orderNumber}: ${ORDER_STATUS_LABEL[status]}`);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not update ticket.",
      );
    } finally {
      await load();
      setUpdating(null);
    }
  };
  const tickets = (data?.tickets ?? []).filter(
    (ticket) =>
      (type === "ALL" || ticket.orderType === type) &&
      `${ticket.orderNumber} ${ticket.customerName}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const late = tickets.filter(
    (ticket) =>
      ticketAge(ticket.scheduledAt ? new Date(new Date(ticket.scheduledAt).getTime()-ticket.estimatedMinutes*60000).toISOString() : ticket.placedAt, ticket.estimatedMinutes, now || Date.now())
        .overdue,
  ).length;
  return (
    <div>
      <PageHeader
        title="Kitchen live"
        description="One shared view from order placed to handover. Oldest tickets first."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPaused((v) => !v)}>
              {paused ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )}
              {paused ? "Resume" : "Pause"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void load()}
              aria-label="Refresh kitchen"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  if (document.fullscreenElement)
                    await document.exitFullscreen();
                  else await document.documentElement.requestFullscreen();
                } catch {
                  toast.error("Fullscreen is not supported in this browser.");
                }
              }}
              aria-label="Toggle kitchen fullscreen"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-4">
        {[
          ["Open tickets", data?.total ?? "—"],
          ["Over estimate", late],
          ["Refresh", paused ? "Paused" : "15 sec"],
        ].map(([label, value]) => (
          <div key={label} className="surface p-3 sm:p-4">
            <p className="text-xs text-charcoal-500">{label}</p>
            <p className="mt-1 text-xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      {failed && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-chilli-400/30 bg-chilli-400/10 p-3 text-sm text-chilli-600"
        >
          {"Kitchen connection interrupted. Displayed tickets may be stale. Refresh before acting."}</p>
      )}
      {data && data.total > data.tickets.length && (
        <p className="mb-4 text-sm text-amber-700">
          {"Showing the oldest"}{data.tickets.length} {"of"}{data.total} {"active tickets. Completed tickets free up space."}</p>
      )}
      <div className="surface mb-5 grid gap-3 p-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-charcoal-500">
          {"Find a ticket"}<input
            aria-label="Find a kitchen ticket"
            className="field mt-1"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order number or customer"
          />
        </label>
        <Select
          label="Service"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="ALL">{"All service types"}</option>
          <option value="DELIVERY">{"Delivery"}</option>
          <option value="PICKUP">{"Pickup"}</option>
        </Select>
      </div>
      <div
        className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1 xl:hidden"
        aria-label="Kitchen lanes"
      >
        {KITCHEN_LANES.map((status) => (
          <button
            type="button"
            key={status}
            aria-pressed={lane === status}
            onClick={() => setLane(status)}
            className={cn(
              "min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold",
              lane === status
                ? "border-chai-500 bg-chai-100 text-chai-700"
                : "bg-surface",
            )}
          >
            {ORDER_STATUS_LABEL[status]} (
            {tickets.filter((t) => t.status === status).length})
          </button>
        ))}
      </div>
      {!data && !failed && (
        <p role="status" className="py-12 text-center text-charcoal-500">
          {"Loading kitchen tickets…"}</p>
      )}
      <div className="grid items-start gap-4 xl:grid-cols-5">
        {KITCHEN_LANES.map((status) => (
          <section
            key={status}
            aria-label={`${ORDER_STATUS_LABEL[status]} tickets`}
            className={cn(
              "min-w-0 rounded-2xl bg-cream-200/50 p-3",
              lane !== status && "hidden xl:block",
            )}
          >
            <h2 className="mb-3 flex items-center justify-between gap-2 text-sm font-bold">
              {ORDER_STATUS_LABEL[status]}
              <span className="rounded-lg bg-surface px-2 py-1 text-xs">
                {tickets.filter((t) => t.status === status).length}
              </span>
            </h2>
            <div className="space-y-3">
              {tickets
                .filter((t) => t.status === status)
                .map((ticket) => {
                  const age = ticketAge(
                    ticket.scheduledAt ? new Date(new Date(ticket.scheduledAt).getTime()-ticket.estimatedMinutes*60000).toISOString() : ticket.placedAt,
                    ticket.estimatedMinutes,
                    now || Date.now(),
                  );
                  const notDue=Boolean(ticket.scheduledAt&&new Date(ticket.scheduledAt).getTime()>Date.now()+ticket.estimatedMinutes*60000);
                  const next = kitchenNext(ticket.status, ticket.orderType);
                  return (
                    <article
                      key={ticket.id}
                      className={cn(
                        "surface overflow-hidden p-3",
                        age.overdue && "border-chilli-400/60",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-sm font-bold">
                          #{ticket.orderNumber}
                        </p>
                        <span className="chip bg-cream-100 text-[10px]">
                          {ORDER_TYPE_LABEL[ticket.orderType]}
                        </span>
                      </div>
                      <p className="mt-2 break-words text-sm text-charcoal-600">
                        {ticket.customerName}
                        {ticket.scheduledAt&&<strong className="mt-1 block text-chai-700">Scheduled: {pakistanTime(ticket.scheduledAt)}</strong>}
                        {ticket.paymentStatus==="PAID"&&<span className="mt-1 block text-xs text-circuit-600">Paid at counter</span>}
                      </p>
                      <p
                        className={cn(
                          "mt-3 flex items-center gap-1.5 text-xs font-semibold",
                          age.overdue ? "text-chilli-600" : "text-charcoal-500",
                        )}
                      >
                        <Clock3 className="h-3.5 w-3.5" />
                        {age.elapsed} {"min elapsed"}{" "}
                        {age.overdue ? "· over estimate" : ""}
                      </p>
                      <div className="my-2 h-1 overflow-hidden rounded-full bg-cream-200">
                        <div
                          className={cn(
                            "h-full",
                            age.overdue ? "bg-chilli-500" : "bg-chai-500",
                          )}
                          style={{ width: `${age.progress}%` }}
                        />
                      </div>
                      <ul className="my-4 space-y-3">
                        {ticket.items.map((item) => (
                          <li key={item.id}>
                            <p className="break-words text-sm font-bold">
                              {item.quantity} × {item.productName}
                            </p>
                            {item.addons.map((a) => (
                              <p
                                key={a.id}
                                className="text-xs text-charcoal-500"
                              >
                                {a.groupName}: {a.addonName}
                              </p>
                            ))}
                            {item.notes && (
                              <p className="mt-1 break-words rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                                {item.notes}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                      {ticket.instructions && (
                        <p className="mb-3 break-words rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                          {"Order note:"}{ticket.instructions}
                        </p>
                      )}
                      {next && (
                        <Button
                          className="w-full px-2 text-xs"
                          loading={updating === ticket.id}
                          disabled={!!updating || failed || (notDue&&next!=="CONFIRMED")}
                          onClick={() => void advance(ticket)}
                        >
                          {next === "DELIVERED"
                            ? "Confirm handover"
                            : ORDER_STATUS_LABEL[next]}
                        </Button>
                      )}
                    </article>
                  );
                })}
              {data && !tickets.some((t) => t.status === status) && (
                <div className="py-10 text-center text-xs text-charcoal-500">
                  <ChefHat className="mx-auto mb-2 h-6 w-6" />
                  {"No tickets in this lane."}</div>
              )}
            </div>
          </section>
        ))}
      </div>
      {data && (
        <p className="mt-4 text-xs text-charcoal-500">
          {"Last successful refresh:"}{" "}
          {new Date(data.fetchedAt).toLocaleTimeString("en-PK")}{". Estimates are measured from order placement."}</p>
      )}
    </div>
  );
}
