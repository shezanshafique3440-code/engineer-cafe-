/** Exact integer arithmetic. Money is paise; inventory quantities have four decimal places. */
export function fixed(
  value: string | number | { toString(): string },
  places: number,
): bigint {
  const text = String(value);
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
  if (!m || (m[3]?.length ?? 0) > places)
    throw new Error(`Use at most ${places} decimal places.`);
  return BigInt(m[1] + (m[2] + (m[3] ?? "").padEnd(places, "0")));
}
export const paise = (value: string | number | { toString(): string }) =>
  fixed(value, 2);
export const quantity = (value: string | number | { toString(): string }) =>
  fixed(value, 4);
export function decimal(value: bigint, places = 2) {
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const scale = 10n ** BigInt(places);
  return `${sign}${abs / scale}.${String(abs % scale).padStart(places, "0")}`;
}
export function divideRound(n: bigint, d: bigint) {
  if (d <= 0n) throw new Error("Invalid divisor");
  const sign = n < 0n ? -1n : 1n;
  const v = n < 0n ? -n : n;
  return sign * ((v + d / 2n) / d);
}
export function issueValue(
  balanceQuantity: bigint,
  balanceValue: bigint,
  used: bigint,
) {
  if (used <= 0n || used > balanceQuantity)
    throw new Error("Insufficient ingredient stock.");
  return used === balanceQuantity
    ? balanceValue
    : divideRound(balanceValue * used, balanceQuantity);
}
export function distribute(total: bigint, weights: bigint[]) {
  const sum = weights.reduce((a, b) => a + b, 0n);
  if (sum === 0n) return weights.map(() => 0n);
  const values = weights.map((w) => (total * w) / sum);
  let remainder = total - values.reduce((a, b) => a + b, 0n);
  for (let i = 0; remainder > 0n; i = (i + 1) % values.length) {
    if (weights[i] > 0n) {
      values[i]++;
      remainder--;
    }
  }
  return values;
}
export function businessToday(now = new Date()) {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (s: string) => p.find((x) => x.type === s)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function dateValue(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Use a valid date.");
  const d = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value)
    throw new Error("Use a valid date.");
  return d;
}
export function payrollMath(input: {
  basis: string;
  base: bigint;
  days: number;
  activeDays: number;
  unpaidHalfDays: number;
  presentHalfDays: number;
  overtimeUnits: bigint;
  overtimeRate: bigint;
  bonus: bigint;
  deduction: bigint;
  advance: bigint;
}) {
  const base =
    input.basis === "DAILY"
      ? divideRound(input.base * BigInt(input.presentHalfDays), 2n)
      : divideRound(input.base * BigInt(input.activeDays), BigInt(input.days));
  const unpaid =
    input.basis === "DAILY"
      ? 0n
      : divideRound(
          input.base * BigInt(input.unpaidHalfDays),
          BigInt(input.days) * 2n,
        );
  const overtime = divideRound(
    input.overtimeRate * input.overtimeUnits,
    10000n,
  );
  const earned = base - unpaid + overtime + input.bonus - input.deduction;
  if (earned < 0n) throw new Error("Deductions exceed earned pay.");
  const recovery = input.advance > earned ? earned : input.advance;
  return { base, unpaid, overtime, earned, recovery, net: earned - recovery };
}

export function businessDayStart(value = businessToday()) { return new Date(dateValue(value).getTime() - 5 * 3600000); }
