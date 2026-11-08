import { canBusiness } from "./business-access";
import type { SessionUser } from "./types";

export type CafeTask = {
  id: string;
  label: string;
  hint: string;
  href: string;
  cap: string;
  group: "daily" | "stock" | "team" | "owner";
};
export const CAFE_TASKS: CafeTask[] = [
  {
    id: "pos",
    label: "Naya bill",
    hint: "Items chunein, payment lein, receipt dein",
    href: "/admin/pos",
    cap: "pos",
    group: "daily",
  },
  {
    id: "tables",
    label: "Tables / Order lein",
    hint: "Table kholein, items add karein, bill settle karein",
    href: "/admin/business?section=tables",
    cap: "tables",
    group: "daily",
  },
  {
    id: "kitchen",
    label: "Kitchen orders",
    hint: "Naya order dekhein aur tayyar karein",
    href: "/admin/kitchen",
    cap: "kitchen",
    group: "daily",
  },
  {
    id: "orders",
    label: "Saare orders",
    hint: "Website, pickup aur order status",
    href: "/admin/orders",
    cap: "orders",
    group: "daily",
  },
  {
    id: "delivery",
    label: "Riders ka hisaab",
    hint: "Delivery dein, cash lein, commission dekhein",
    href: "/admin/business?section=delivery",
    cap: "delivery",
    group: "daily",
  },
  {
    id: "cash",
    label: "Cash opening / closing",
    hint: "Apna drawer kholein ya cash gin kar band karein",
    href: "/admin/business?section=cash",
    cap: "cash",
    group: "daily",
  },
  {
    id: "purchases",
    label: "Maal khareeda",
    hint: "Supplier ka bill aur received stock enter karein",
    href: "/admin/business?section=purchases",
    cap: "purchases",
    group: "stock",
  },
  {
    id: "inventory",
    label: "Stock dekhein",
    hint: "Ingredient quantity aur stock movements",
    href: "/admin/business?section=inventory",
    cap: "stock-read",
    group: "stock",
  },
  {
    id: "stockcounts",
    label: "Stock ginein",
    hint: "Asal stock gin kar difference review karein",
    href: "/admin/business?section=stockcounts",
    cap: "inventory",
    group: "stock",
  },
  {
    id: "expenses",
    label: "Kharcha likhein",
    hint: "Rent, bijli ya doosra actual kharcha",
    href: "/admin/business?section=expenses",
    cap: "expenses",
    group: "stock",
  },
  {
    id: "attendance",
    label: "Hazri lagayein",
    hint: "Hazir, chhutti aur overtime record karein",
    href: "/admin/business?section=attendance",
    cap: "attendance",
    group: "team",
  },
  {
    id: "staff",
    label: "Staff aur salary",
    hint: "Employee ki details aur salary rate",
    href: "/admin/business?section=staff",
    cap: "payroll",
    group: "team",
  },
  {
    id: "payroll",
    label: "Salary dein",
    hint: "Draft check karein, approve karein, payment dein",
    href: "/admin/business?section=payroll",
    cap: "payroll",
    group: "team",
  },
  {
    id: "overview",
    label: "Aaj ka hisaab",
    hint: "Sales, food cost aur profit ki report",
    href: "/admin/business?section=overview",
    cap: "reports",
    group: "owner",
  },
  {
    id: "receivables",
    label: "Udhaar ki recovery",
    hint: "Customer se mili actual payment record karein",
    href: "/admin/business?section=receivables",
    cap: "payments",
    group: "owner",
  },
  {
    id: "approvals",
    label: "Approval dein",
    hint: "Discount, refund aur review requests",
    href: "/admin/business?section=approvals",
    cap: "payments",
    group: "owner",
  },
  {
    id: "setup",
    label: "Setup aur staff access",
    hint: "Opening setup aur login permissions",
    href: "/admin/business?section=setup",
    cap: "setup",
    group: "owner",
  },
];
export function tasksFor(user: SessionUser | null | undefined) {
  const tasks = CAFE_TASKS.filter((task) => canBusiness(user, task.cap));
  const first =
    user?.businessProfile === "WAITER"
      ? "tables"
      : user?.businessProfile === "CHEF"
        ? "kitchen"
        : user?.businessProfile === "CASHIER"
          ? "pos"
          : "overview";
  return [
    ...tasks.filter((t) => t.id === first),
    ...tasks.filter((t) => t.id !== first),
  ];
}
export const TASK_GUIDES: Record<
  string,
  { title: string; steps: string[]; tip: string }
> = {
  overview: {
    title: "Aaj kitni sale aur kitna munafa?",
    steps: [
      "Date chunein",
      "Sales aur food cost dekhein",
      "Profit aur cash alag check karein",
    ],
    tip: "Sale, profit aur drawer ka cash alag figures hain. Report export bhi kar sakte hain.",
  },
  inventory: {
    title: "Maal kitna baqi hai?",
    steps: [
      "Ingredient dhoondein",
      "Quantity aur unit dekhein",
      "Zaroorat par purchase ya count karein",
    ],
    tip: "Supplier se aaya maal Purchases mein likhein. Wohi stock dobara opening adjustment mein add na karein.",
  },
  recipes: {
    title: "Ek item banane mein kya lagta hai?",
    steps: [
      "Menu item chunein",
      "Ingredients ki quantity likhein",
      "Recipe save karein",
    ],
    tip: "Quantity ingredient ki stock unit mein likhein. Is recipe se stock aur food cost calculate hoti hai.",
  },
  purchases: {
    title: "Supplier se maal aaya",
    steps: [
      "Supplier aur invoice chunein",
      "Maal, quantity aur cost likhein",
      "Stock receive karein; actual payment alag likhein",
    ],
    tip: "Sirf waqai receive hua maal enter karein. Udhaar invoice ki payment baad mein bhi ho sakti hai.",
  },
  procurement: {
    title: "Maal mangwana hai",
    steps: [
      "Purchase order banayein",
      "Order approve / send karein",
      "Aane par invoice se receive karein",
    ],
    tip: "Order dene se stock nahi barhta; received invoice post hone par barhta hai.",
  },
  stockcounts: {
    title: "Asal stock gin kar milayein",
    steps: [
      "Ingredients chunein",
      "Asal quantity ginein",
      "Difference review karke post karein",
    ],
    tip: "Jo quantity asal mein hai woh likhein. System se milane ke liye count na badlein.",
  },
  delivery: {
    title: "Delivery se cash jama tak",
    steps: [
      "Order rider ko dein",
      "Delivery complete karein",
      "Cash jama aur commission record karein",
    ],
    tip: "Net food amount par 15% commission hai. Counter-paid order ka cash rider se dobara na lein.",
  },
  tables: {
    title: "Table ka poora kaam",
    steps: [
      "Khali table kholein",
      "Items add karke kitchen bhejein",
      "Payment lein, phir table close karein",
    ],
    tip: "Har table card par total, received aur baqi amount dekhein. Ek table par naye tickets add ho sakte hain.",
  },
  cash: {
    title: "Subah drawer kholein, raat cash milayein",
    steps: [
      "Subah starting cash ginein",
      "Din ki payments record karein",
      "Raat pending bills check karke cash ginein",
    ],
    tip: "Apne login ki shift use karein. Asal counted cash likhein aur difference ka reason dein.",
  },
  expenses: {
    title: "Kharcha record karein",
    steps: [
      "Kharchay ki type chunein",
      "Amount aur payment account likhein",
      "Reason ke saath save karein",
    ],
    tip: "Cash/bank transfer sale ya kharcha nahi hota. Supplier aur salary payments unki apni screens se karein.",
  },
  staff: {
    title: "Staff ki details",
    steps: [
      "Employee add karein",
      "Salary rate aur joining date likhein",
      "Zaroorat par login access link karein",
    ],
    tip: "Employee record aur staff login alag hain. Attendance aur salary isi employee record par chalti hain.",
  },
  attendance: {
    title: "Aaj ki hazri",
    steps: [
      "Employee aur date chunein",
      "Hazri / chhutti aur time likhein",
      "Overtime check karke save karein",
    ],
    tip: "Actual clock-in / clock-out Pakistan time mein likhein. Salary calculate karne se pehle hazri check karein.",
  },
  payroll: {
    title: "Salary ka seedha process",
    steps: [
      "Period ka draft banayein",
      "Salary, advance aur deductions check karein",
      "Post karein, phir actual payment likhein",
    ],
    tip: "Draft banana payment nahi hai. Sirf waqai di hui salary ko paid record karein.",
  },
  receivables: {
    title: "Customer ne udhaar wapas diya",
    steps: [
      "Customer chunein",
      "Actual amount aur account likhein",
      "Collection save karein",
    ],
    tip: "Purane udhaar ki recovery nayi sale nahi hai.",
  },
  suppliers: {
    title: "Supplier ka baqi hisaab",
    steps: [
      "Supplier chunein",
      "Dues / advance dekhein",
      "Actual payment ya refund record karein",
    ],
    tip: "Invoice aur supplier payment alag records hain; ek payment dobara enter na karein.",
  },
  customers: {
    title: "Udhaar customers",
    steps: [
      "Customer record banayein",
      "Credit limit check karein",
      "Collections se payment receive karein",
    ],
    tip: "Credit sale sirf approved customer ke liye karein.",
  },
  approvals: {
    title: "Request check karke faisla karein",
    steps: [
      "Request aur amount dekhein",
      "Order / cart aur reason check karein",
      "Approve ya reject karein",
    ],
    tip: "Approval actual refund ya payment ka badal nahi. Related payment ka status bhi check karein.",
  },
  ledger: {
    title: "Detailed financial record",
    steps: [
      "Date range chunein",
      "Account aur balances dekhein",
      "Zaroorat par report export karein",
    ],
    tip: "Yeh owner ki detailed report hai. Roz ke totals Business overview mein milte hain.",
  },
  audit: {
    title: "Kis ne kya change kiya?",
    steps: [
      "Date chunein",
      "Staff / record search karein",
      "Change ki details dekhein",
    ],
    tip: "History ko edit nahi kiya jata. Correction related screen par proper reversal se karein.",
  },
  setup: {
    title: "Owner ka initial setup",
    steps: [
      "Real stock aur opening balances",
      "Recipes aur staff permissions",
      "Readiness check ke baad activation",
    ],
    tip: "Ye roz ka kaam nahi. Existing opening balances dobara enter na karein; active integration ko bila wajah off na karein.",
  },
};
