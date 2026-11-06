export type ScheduleRules = {
  schedulingEnabled: boolean;
  scheduleLeadMinutes: number;
  scheduleDaysAhead: number;
  scheduleOpenMinute: number;
  scheduleCloseMinute: number;
};
export function scheduleError(
  value: string | null | undefined,
  rules: ScheduleRules,
  now = Date.now(),
): string | null {
  if (!value) return null;
  if (!rules.schedulingEnabled)
    return "Scheduled orders are unavailable right now.";
  const time = Date.parse(value);
  if (!Number.isFinite(time) || time < now + rules.scheduleLeadMinutes * 60000)
    return `Choose a time at least ${rules.scheduleLeadMinutes} minutes ahead.`;
  if (time > now + rules.scheduleDaysAhead * 86400000)
    return `Orders can be scheduled up to ${rules.scheduleDaysAhead} days ahead.`;
  const local = new Date(time + 5 * 3600000);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const open = rules.scheduleOpenMinute,
    close = rules.scheduleCloseMinute;
  const allowed =
    open === close ||
    (open < close
      ? minute >= open && minute < close
      : minute >= open || minute < close);
  return allowed
    ? null
    : "Choose a time within the cafe's scheduled ordering hours (Pakistan time).";
}
export function pakistanTime(value: string) {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
export function loyaltyReward(
  balance: number,
  subtotal: number,
  points: number,
  value: number,
) {
  return balance >= points && subtotal >= value
    ? { points, discount: value }
    : { points: 0, discount: 0 };
}
