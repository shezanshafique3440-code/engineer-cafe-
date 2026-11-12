import Link from "next/link";
export const metadata = { title: "Counter quick start" };
const steps = [
  [
    "1. Open your shift",
    "Count the opening cash in Cash closing. Open the shift under the login taking payments, then go to New sale. Wait for Offline counter ready before relying on saved cash billing.",
  ],
  [
    "2. Create a sale",
    "Choose items, check the total, enter actual cash received and check the change. Record payment once, then print the confirmed receipt.",
  ],
  [
    "3. Follow the kitchen",
    "Use Kitchen to mark Preparing and Ready. Collect any unpaid balance before handover, then complete the order in Orders.",
  ],
  [
    "4. Keep working during an outage",
    "Your prepared cash counter retains the draft. Save each bill on this device. Reconnect to synchronize; each bill needs server confirmation. Use Check & recover bill when the original online response is uncertain.",
  ],
  [
    "5. Close the day",
    "Confirm the last counter bill and sync saved bills. Review table payments, rider cash and other devices. Count actual drawer cash in Cash closing, explain differences and close the shift.",
  ],
  [
    "6. Find owner tools",
    "All tools & administration contains the existing reports/Excel downloads, stock, purchases, expenses, employees, attendance, salaries, website settings and access tools. Employee records do not require a separate login for every employee.",
  ],
];
export default function Page() {
  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <header>
        <p className="eyebrow">Keep this routine simple</p>
        <h1 className="mt-2 text-3xl font-extrabold">Counter quick start</h1>
        <p className="mt-2 text-sm text-charcoal-600">
          One routine for the counter, with the full management system available
          to owners.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {steps.map(([title, body]) => (
          <section key={title} className="surface p-5">
            <h2 className="font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-charcoal-600">
              {body}
            </p>
          </section>
        ))}
      </div>
      <p className="rounded-xl border border-chai-200 bg-chai-50 p-4 text-sm">
        Keep browser storage intact while bills are pending. A TEST name does
        not automatically mark a sale for demo cleanup. Review real opening
        stock/balances and practice records before live trading.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/admin" className="btn-primary">
          Daily counter
        </Link>
        <Link href="/admin/tools" className="btn-secondary">
          All tools & administration
        </Link>
      </div>
    </article>
  );
}
