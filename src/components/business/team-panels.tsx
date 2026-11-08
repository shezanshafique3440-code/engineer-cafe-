"use client";
import { useState, useRef } from "react";
import { apiPost } from "@/lib/api-client";
import { Button } from "@/components/ui";
import {
  Form,
  Table,
  Cell,
  Notice,
  options,
  rows,
  text,
  object,
  money,
  day,
  type Row,
  type Field,
} from "./shared";
import { paise, decimal } from "@/lib/business-math";
import { printBusinessSlip } from "@/lib/business-slip";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/csv";
const note: Field = { name: "note", label: "Reason / reference" };
export function StaffPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const [editing, setEditing] = useState<Row | null>(null),
    [advance, setAdvance] = useState<Row | null>(null);
  const done = () => {
    setEditing(null);
    setAdvance(null);
    reload();
  };
  const staff = rows(data, "employees");
  return (
    <div className="space-y-5">
      <Notice>
        Keep employment dates accurate. Monthly pay is prorated by calendar
        days; daily pay uses recorded attendance. Unpaid leave, overtime,
        bonuses, deductions and advance recovery are reviewed in payroll before
        posting.
      </Notice>
      <Form
        key={text(editing ?? undefined, "id", "new")}
        title={editing ? "Edit employee" : "Add employee"}
        module="staff"
        fields={[
          {
            name: "name",
            label: "Full name",
            value: text(editing ?? undefined, "party.name"),
          },
          {
            name: "code",
            label: "Employee code",
            value: text(editing ?? undefined, "code"),
          },
          {
            name: "phone",
            label: "Phone",
            required: false,
            value: text(editing ?? undefined, "party.phone"),
          },
          {
            name: "designation",
            label: "Job / designation",
            value: text(editing ?? undefined, "designation"),
            hint: "Waiter, chef, cashier, cleaner, manager…",
          },
          {
            name: "payBasis",
            label: "Salary basis",
            type: "select",
            options: [
              { value: "MONTHLY", label: "Monthly salary" },
              { value: "DAILY", label: "Daily wage" },
            ],
            value: text(editing ?? undefined, "payBasis", "MONTHLY"),
          },
          {
            name: "basePay",
            label: "Contract pay (Rs.)",
            type: "number",
            min: "0",
            value: text(editing ?? undefined, "basePay", "0"),
          },
          {
            name: "overtimeRate",
            label: "Approved overtime rate per hour (Rs.)",
            type: "number",
            min: "0",
            value: text(editing ?? undefined, "overtimeRate", "0"),
          },
          {
            name: "joinedOn",
            label: "Joining date",
            type: "date",
            value: day(editing?.joinedOn) || text(data, "today"),
          },
          {
            name: "leftOn",
            label: "Leaving date",
            type: "date",
            required: false,
            value: day(editing?.leftOn),
          },
          {
            name: "notes",
            label: "Employment notes",
            required: false,
            value: text(editing ?? undefined, "notes"),
          },
          {
            name: "isActive",
            label: "Active employee",
            type: "checkbox",
            value: editing ? Boolean(editing.isActive) : true,
          },
          ...(!editing
            ? [
                {
                  name: "createLogin",
                  label: "Create a staff login",
                  type: "checkbox" as const,
                  value: false,
                },
                {
                  name: "email",
                  label: "Login email",
                  type: "email" as const,
                  visible: (v: Record<string, string | boolean>) =>
                    Boolean(v.createLogin),
                },
                {
                  name: "password",
                  label: "Initial password",
                  type: "password" as const,
                  visible: (v: Record<string, string | boolean>) =>
                    Boolean(v.createLogin),
                  hint: "At least 8 characters. Staff can change this in their account.",
                },
                {
                  name: "profile",
                  label: "Staff access",
                  type: "select" as const,
                  options: ["WAITER", "CHEF", "CASHIER", "MANAGER"].map(
                    (value) => ({ value, label: value }),
                  ),
                  value: "WAITER",
                  visible: (v: Record<string, string | boolean>) =>
                    Boolean(v.createLogin),
                },
              ]
            : []),
        ]}
        build={(v) => ({
          name: v.name,
          code: v.code,
          phone: v.phone,
          designation: v.designation,
          payBasis: v.payBasis,
          basePay: v.basePay,
          overtimeRate: v.overtimeRate,
          joinedOn: v.joinedOn,
          leftOn: v.leftOn || null,
          notes: v.notes,
          isActive: v.isActive,
          id: editing?.id,
          version: editing?.version,
          ...(v.createLogin
            ? {
                login: {
                  email: v.email,
                  password: v.password,
                  profile: v.profile,
                },
              }
            : {}),
        })}
        onDone={done}
        submitLabel="Save employee"
      />
      {advance && (
        <Form
          key={text(advance, "id")}
          title={"Staff payment / repayment · " + text(advance, "party.name")}
          module="payments"
          fields={[
            {
              name: "kind",
              label: "Transaction",
              type: "select",
              value: "STAFF_ADVANCE",
              options: [
                { value: "STAFF_ADVANCE", label: "Advance paid to employee" },
                {
                  value: "SALARY_BALANCE_PAYMENT",
                  label: "Pay legacy opening salary dues",
                },
                {
                  value: "STAFF_REPAYMENT",
                  label: "Advance returned by employee",
                },
              ],
            },
            {
              name: "amount",
              label: "Amount (Rs.)",
              type: "number",
              min: "0.01",
            },
            {
              name: "accountId",
              label: "Paid from",
              type: "select",
              options: options(rows(data, "accounts")),
            },
            {
              name: "date",
              label: "Payment date",
              type: "date",
              value: text(data, "today"),
            },
            note,
          ]}
          build={(v) => ({
            ...v,
            partyId: advance.partyId,
          })}
          onDone={done}
          submitLabel="Record staff transaction"
        />
      )}
      <Table
        headers={[
          "Employee",
          "Contract",
          "Advance outstanding",
          "Salary payable",
          "Login",
          "Actions",
        ]}
        empty={!staff.length}
      >
        {staff.map((e) => (
          <tr key={text(e, "id")}>
            <Cell>
              <strong>{text(e, "party.name")}</strong>
              <p className="text-xs text-charcoal-500">
                {text(e, "code")} · {text(e, "designation")}
              </p>
              <p className="text-xs">
                Joined {day(e.joinedOn)}
                {e.leftOn ? " · Left " + day(e.leftOn) : ""}
                {!e.isActive ? " · Inactive" : ""}
              </p>
            </Cell>
            <Cell>
              {money(e.basePay)}
              <p className="text-xs">
                {text(e, "payBasis")} · OT {money(e.overtimeRate)}/h
              </p>
            </Cell>
            <Cell>{money(e.advance)}</Cell>
            <Cell>{money(e.salaryDue)}</Cell>
            <Cell>
              {text(e, "access.user.email", "No login")}
              <p className="text-xs">{text(e, "access.profile")}</p>
            </Cell>
            <Cell>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEditing(e)}
                >
                  Edit
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setAdvance(e)}
                >
                  Record payment
                </Button>
              </div>
            </Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}
export function AttendancePanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const [editing, setEditing] = useState<Row | null>(null),
    [quickBusy, setQuickBusy] = useState("");
  const requests = useRef<Record<string, string>>({});
  const submitting = useRef(false);
  const quickAttendance = async (employee: Row, status: string) => {
    if (submitting.current) return;
    submitting.current = true;
    const key = text(employee, "id") + ":" + text(data, "today") + ":" + status;
    requests.current[key] ??= crypto.randomUUID();
    setQuickBusy(text(employee, "id"));
    try {
      await apiPost("/api/admin/business/attendance", {
        requestId: requests.current[key],
        employeeId: employee.id,
        date: data.today,
        status,
        overtimeHours: "0",
        notes: "Daily attendance desk",
      });
      toast.success("Attendance saved.");
      reload();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not save attendance.",
      );
    } finally {
      submitting.current = false;
      setQuickBusy("");
    }
  };
  return (
    <div className="space-y-5">
      <section aria-label="Today's attendance">
        <h2 className="mb-3 text-xl font-bold">
          Today&apos;s attendance · {text(data, "today")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows(data, "employees").map((e) => {
            const recorded = rows(data, "todayAttendance").find(
              (a) =>
                a.employeeId === e.id && day(a.date) === text(data, "today"),
            );
            return (
              <article className="surface p-4" key={text(e, "id")}>
                <h3 className="font-bold">{text(e, "party.name")}</h3>
                <p className="mb-3 text-sm text-charcoal-500">
                  {text(e, "code")}
                </p>
                {recorded ? (
                  <>
                    <p className="font-semibold">
                      {text(recorded, "status").replaceAll("_", " ")}
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing(recorded);
                        document
                          .getElementById("attendance-detail-form")
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                      }}
                    >
                      Edit attendance / times
                    </Button>
                  </>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "PRESENT", label: "Present" },
                      { id: "ABSENT", label: "Absent" },
                      { id: "PAID_LEAVE", label: "Paid leave" },
                      { id: "UNPAID_LEAVE", label: "Unpaid leave" },
                    ].map((s) => (
                      <Button
                        key={s.id}
                        size="sm"
                        variant={s.id === "PRESENT" ? "primary" : "secondary"}
                        disabled={Boolean(quickBusy)}
                        onClick={() => void quickAttendance(e, s.id)}
                      >
                        {s.label}
                      </Button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-charcoal-500">
          Quick attendance does not add clock times or overtime. Use the form
          below for times, half days and corrections.
        </p>
      </section>
      <div id="attendance-detail-form" className="scroll-mt-24" />
      <Form
        key={text(editing ?? undefined, "id", "new")}
        title={editing ? "Edit attendance" : "Record attendance"}
        module="attendance"
        fields={[
          {
            name: "employeeId",
            label: "Employee",
            type: "select",
            options: rows(data, "employees").map((e) => ({
              value: text(e, "id"),
              label: text(e, "code") + " · " + text(e, "party.name"),
            })),
            value: text(editing ?? undefined, "employeeId"),
          },
          {
            name: "date",
            label: "Work date",
            type: "date",
            value: day(editing?.date) || text(data, "today"),
          },
          {
            name: "status",
            label: "Attendance",
            type: "select",
            options: [
              "PRESENT",
              "ABSENT",
              "PAID_LEAVE",
              "UNPAID_LEAVE",
              "HALF_DAY",
            ].map((value) => ({
              value,
              label: (
                {
                  PRESENT: "Present",
                  ABSENT: "Absent",
                  PAID_LEAVE: "Paid leave",
                  UNPAID_LEAVE: "Unpaid leave",
                  HALF_DAY: "Half day",
                } as Record<string, string>
              )[value],
            })),
            value: text(editing ?? undefined, "status", "PRESENT"),
          },
          {
            name: "clockInTime",
            label: "Actual clock-in (Pakistan time)",
            type: "time",
            required: false,
            value: clockTime(editing?.clockIn),
          },
          {
            name: "clockOutTime",
            label: "Actual clock-out (Pakistan time)",
            type: "time",
            required: false,
            value: clockTime(editing?.clockOut),
            hint: "An earlier time is treated as the next day for overnight shifts.",
          },
          {
            name: "overtimeHours",
            label: "Approved overtime hours",
            type: "number",
            min: "0",
            max: "24",
            step: "0.25",
            value: text(editing ?? undefined, "overtimeHours", "0"),
          },
          {
            name: "notes",
            label: "Shift / attendance note",
            required: false,
            value: text(editing ?? undefined, "notes"),
          },
        ]}
        build={(v) => ({
          ...v,
          ...attendanceClocks(v),
          version:
            editing?.version ??
            (text(
              rows(data, "attendance").find(
                (a) => a.employeeId === v.employeeId && day(a.date) === v.date,
              ),
              "version",
            ) ||
              undefined),
        })}
        onDone={() => {
          setEditing(null);
          reload();
        }}
        submitLabel="Record attendance"
      />
      <Table
        headers={["Date", "Employee", "Status", "Overtime", "Note", "Actions"]}
        empty={!rows(data, "attendance").length}
      >
        {rows(data, "attendance").map((a) => (
          <tr key={text(a, "id")}>
            <Cell>{day(a.date)}</Cell>
            <Cell>
              {text(a, "employee.party.name")}
              <p className="text-xs">{text(a, "employee.code")}</p>
            </Cell>
            <Cell>{text(a, "status")}</Cell>
            <Cell>{text(a, "overtimeHours")} h</Cell>
            <Cell>{text(a, "notes")}</Cell>
            <Cell>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(a)}
              >
                Edit
              </Button>
            </Cell>
          </tr>
        ))}
      </Table>
    </div>
  );
}
export function PayrollPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const [editing, setEditing] = useState<Row | null>(null),
    [posting, setPosting] = useState<Row | null>(null),
    [paying, setPaying] = useState<Row | null>(null),
    [reversing, setReversing] = useState<Row | null>(null);
  const current = text(data, "today").slice(0, 7);
  const last = new Date(
    Date.UTC(Number(current.slice(0, 4)), Number(current.slice(5, 7)), 0),
  )
    .toISOString()
    .slice(0, 10);
  const done = () => {
    setEditing(null);
    setPosting(null);
    setPaying(null);
    setReversing(null);
    reload();
  };
  const draftFields: Field[] = [
    {
      name: "employeeId",
      label: "Employee",
      type: "select",
      options: rows(data, "employees").map((e) => ({
        value: text(e, "id"),
        label: text(e, "code") + " · " + text(e, "party.name"),
      })),
      value: text(editing ?? undefined, "employeeId"),
    },
    {
      name: "start",
      label: "Pay period starts",
      type: "date",
      value: day(editing?.startsOn) || current + "-01",
    },
    {
      name: "end",
      label: "Pay period ends",
      type: "date",
      value: day(editing?.endsOn) || last,
    },
    {
      name: "bonus",
      label: "Bonus (Rs.)",
      type: "number",
      min: "0",
      value: text(editing ?? undefined, "bonus", "0"),
    },
    {
      name: "deduction",
      label: "Other deduction (Rs.)",
      type: "number",
      min: "0",
      value: text(editing ?? undefined, "manualDeduction", "0"),
    },
    {
      name: "recoverAdvance",
      label: "Recover outstanding salary advance",
      type: "checkbox",
      value: editing ? Boolean(getSnapshot(editing).recoverAdvance) : true,
    },
    { ...note, value: text(editing ?? undefined, "note") },
  ];
  return (
    <div className="space-y-5">
      <Notice>
        Draft payroll first, review attendance and adjustments, then post the
        liability. A salary payment is a separate cash/bank transaction. Pay
        periods must be within one calendar month and cannot overlap another
        posted payroll.
      </Notice>
      <Form
        key={text(editing ?? undefined, "id", "new")}
        title={editing ? "Recalculate payroll draft" : "Prepare payroll draft"}
        module="payroll"
        fields={draftFields}
        build={(v) => ({
          ...v,
          action: "DRAFT",
          id: editing?.id,
          version: editing?.version,
        })}
        onDone={done}
        submitLabel="Calculate draft"
      />
      {posting && (
        <Form
          key={"post:" + text(posting, "id")}
          title={"Post payroll · " + text(posting, "employee.party.name")}
          description={`Earned ${money(posting.earnedPay)} · Advance recovery ${money(posting.advanceApplied)} · Payable ${money(posting.netPay)}. Posting does not pay the salary.`}
          module="payroll"
          fields={[
            {
              name: "acknowledgeAttendance",
              label: "I reviewed the attendance, including any unrecorded days",
              type: "checkbox",
              value: false,
            },
          ]}
          build={(v) => ({
            ...v,
            action: "POST",
            id: posting.id,
            version: posting.version,
          })}
          onDone={done}
          submitLabel="Post salary liability"
        />
      )}
      {paying && (
        <Form
          key={"pay:" + text(paying, "id")}
          title={"Pay salary · " + text(paying, "employee.party.name")}
          module="payments"
          fields={[
            {
              name: "amount",
              label: "Payment amount (Rs.)",
              type: "number",
              min: "0.01",
              value: decimal(
                paise(text(paying, "netPay", "0")) -
                  paise(text(paying, "paid", "0")),
              ),
            },
            {
              name: "accountId",
              label: "Paid from",
              type: "select",
              options: options(rows(data, "accounts")),
            },
            {
              name: "date",
              label: "Payment date",
              type: "date",
              value: text(data, "today"),
            },
            note,
          ]}
          build={(v) => ({
            ...v,
            kind: "PAYROLL_PAYMENT",
            partyId: text(paying, "employee.partyId"),
            payrollId: paying.id,
          })}
          onDone={done}
          submitLabel="Record salary payment"
        />
      )}
      {reversing && (
        <Form
          title="Reverse unpaid payroll"
          description="Paid payroll must have its payments reversed through the ledger first."
          module="payroll"
          fields={[note]}
          build={(v) => ({ ...v, action: "REVERSE", id: reversing.id })}
          onDone={done}
          submitLabel="Reverse payroll"
        />
      )}
      <div className="space-y-4">
        {rows(data, "payroll").map((p) => (
          <article key={text(p, "id")} className="surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">
                  {text(p, "employee.party.name")}
                </h3>
                <p className="text-xs text-charcoal-500">
                  {text(p, "period")} · {text(p, "status")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void printBusinessSlip(
                      "Salary slip · " + text(p, "employee.party.name"),
                      [
                        [
                          "Employee",
                          text(p, "employee.code") +
                            " · " +
                            text(p, "employee.party.name"),
                        ],
                        ["Period", text(p, "period")],
                        ["Status", text(p, "status")],
                        ["Base pay for period", money(p.basePay)],
                        ["Unpaid leave deduction", money(p.unpaidDeduction)],
                        ["Overtime", money(p.overtimePay)],
                        ["Bonus", money(p.bonus)],
                        ["Other deduction", money(p.manualDeduction)],
                        ["Advance recovery", money(p.advanceApplied)],
                        [
                          p.status === "POSTED"
                            ? "Net salary payable"
                            : "Calculated net (not posted)",
                          money(p.netPay),
                        ],
                        ["Paid", money(p.paid)],
                        [
                          "Remaining",
                          p.status !== "POSTED"
                            ? "Not due · " + text(p, "status")
                            : money(
                                decimal(
                                  paise(text(p, "netPay", "0")) -
                                    paise(text(p, "paid", "0")),
                                ),
                              ),
                        ],
                      ],
                      "A salary calculation is not proof of payment. Payments are recorded separately.\n" +
                        text(p, "note"),
                    ).catch((e) => toast.error(e.message))
                  }
                >
                  Print salary slip
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    downloadCsv(
                      "salary-" + text(p, "employee.code") + ".csv",
                      [
                        "Employee",
                        "Period",
                        "Status",
                        "Base",
                        "Unpaid deduction",
                        "Overtime",
                        "Bonus",
                        "Manual deduction",
                        "Advance recovery",
                        "Net payable",
                        "Paid",
                      ],
                      [
                        [
                          text(p, "employee.party.name"),
                          text(p, "period"),
                          text(p, "status"),
                          text(p, "basePay"),
                          text(p, "unpaidDeduction"),
                          text(p, "overtimePay"),
                          text(p, "bonus"),
                          text(p, "manualDeduction"),
                          text(p, "advanceApplied"),
                          text(p, "netPay"),
                          text(p, "paid"),
                        ],
                      ],
                    )
                  }
                >
                  Export salary
                </Button>
                {p.status === "DRAFT" ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setEditing(p)}
                    >
                      Recalculate
                    </Button>
                    <Button size="sm" onClick={() => setPosting(p)}>
                      Review & post
                    </Button>
                  </>
                ) : p.status === "POSTED" ? (
                  <>
                    <Button size="sm" onClick={() => setPaying(p)}>
                      Pay salary
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setReversing(p)}
                    >
                      Reverse unpaid
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-cream-50 p-3">
                <p className="text-xs text-charcoal-500">Total salary (net)</p>
                <p className="font-bold">{money(p.netPay)}</p>
              </div>
              <div className="rounded-xl bg-cream-50 p-3">
                <p className="text-xs text-charcoal-500">Paid</p>
                <p className="font-bold">{money(p.paid)}</p>
              </div>
              <div className="rounded-xl bg-chai-50 p-3">
                <p className="text-xs text-charcoal-500">Salary remaining</p>
                <p className="font-bold">
                  {p.status === "POSTED"
                    ? money(
                        decimal(
                          paise(text(p, "netPay", "0")) -
                            paise(text(p, "paid", "0")),
                        ),
                      )
                    : "Draft / not posted"}
                </p>
              </div>
            </div>
            <details className="mt-3">
              <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold">
                Salary breakdown
              </summary>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                {[
                  ["Base for period", p.basePay],
                  ["Unpaid leave deduction", p.unpaidDeduction],
                  ["Overtime", p.overtimePay],
                  ["Bonus", p.bonus],
                  ["Other deduction", p.manualDeduction],
                  ["Advance recovery", p.advanceApplied],
                  ["Salary payable", p.netPay],
                  ["Paid", p.paid],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt className="text-xs text-charcoal-500">
                      {String(label)}
                    </dt>
                    <dd className="mt-1 font-bold">{money(value)}</dd>
                  </div>
                ))}
              </dl>
            </details>
            <p className="mt-4 text-xs text-charcoal-500">
              Attendance: {text(getSnapshot(p), "attendanceDays")} /{" "}
              {text(getSnapshot(p), "activeDays")} days recorded · Overtime{" "}
              {text(getSnapshot(p), "overtimeHours")} h
            </p>
            {Number(getSnapshot(p).missingAttendanceDays) > 0 && (
              <p className="mt-2 text-sm font-semibold text-chilli-600">
                {text(getSnapshot(p), "missingAttendanceDays")} employment days
                have no attendance record. Review before posting.
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
function getSnapshot(row: Row) {
  return object(row, "snapshot");
}

function clockTime(value: unknown) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(String(value)));
}
function attendanceClocks(v: Record<string, string | boolean>) {
  const start = v.clockInTime
    ? new Date(`${v.date}T${v.clockInTime}:00+05:00`)
    : null;
  let end = v.clockOutTime
    ? new Date(`${v.date}T${v.clockOutTime}:00+05:00`)
    : null;
  if (start && end && end <= start) end = new Date(end.getTime() + 86400000);
  return {
    clockIn: start?.toISOString() ?? null,
    clockOut: end?.toISOString() ?? null,
  };
}
