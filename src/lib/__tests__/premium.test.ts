import assert from "node:assert/strict";
import { test } from "node:test";
import { planMeals, selectedOptions } from "../menu-planner";
import { encodeSharedCart, decodeSharedCart } from "../shared-cart";
import {
  buildInsights,
  customerKey,
  type InsightOrder,
} from "../cafe-insights";
import { kitchenNext, ticketAge } from "../kitchen";
import { menuQrUrl, escapeMarkup } from "../qr-menu";
import type { ProductDTO } from "../types";
function product(
  id: string,
  category: string,
  price: number,
  other: Partial<ProductDTO> = {},
): ProductDTO {
  return {
    id,
    name: id,
    slug: id,
    urduName: null,
    description: "",
    longDescription: null,
    price,
    discountPrice: null,
    image: null,
    isAvailable: true,
    isFeatured: false,
    isPopular: false,
    isVegetarian: true,
    spiceLevel: "MILD",
    prepTimeMinutes: 10,
    ingredients: [],
    calories: null,
    stock: null,
    ratingAverage: 4,
    ratingCount: 3,
    soldCount: 0,
    createdAt: "2026-11-01T00:00:00Z",
    hasOptions: false,
    category: { id: category, name: category, slug: category },
    addonGroups: [],
    ...other,
  };
}
const main = product("paratha", "parathas", 150, {
  hasOptions: true,
  addonGroups: [
    {
      id: "style",
      name: "Style",
      slug: "style",
      type: "SINGLE",
      isRequired: true,
      minSelect: 1,
      maxSelect: 1,
      addons: [
        {
          id: "ghee",
          name: "Ghee",
          price: 30,
          isDefault: true,
          isAvailable: true,
        },
      ],
    },
  ],
});
const drink = product("chai", "chai", 90);
const preferences = {
  budget: 540,
  people: 2,
  vegetarian: true,
  mild: true,
  includeDrink: true,
};
test("meal budgets include required add-ons and the full group quantity", () => {
  const plans = planMeals([main, drink], preferences);
  assert.equal(plans.length, 1);
  assert.equal(plans[0].total, 540);
  assert.equal(plans[0].lines[0].addons[0].id, "ghee");
  assert.equal(
    planMeals([main, drink], { ...preferences, budget: 539 }).length,
    0,
  );
});
test("meal finder excludes unavailable, insufficient stock and mismatched dietary items", () => {
  for (const change of [
    { isAvailable: false },
    { stock: 1 },
    { isVegetarian: false },
    { spiceLevel: "HOT" as const },
  ])
    assert.equal(
      planMeals([{ ...main, ...change }, drink], preferences).length,
      0,
    );
  assert.equal(
    planMeals([main, drink], { ...preferences, people: 0 }).length,
    0,
  );
});
test("meal finder will not invent missing required options", () => {
  const bad = {
    ...main,
    addonGroups: main.addonGroups!.map((g) => ({ ...g, addons: [] })),
  };
  assert.equal(planMeals([bad, drink], preferences).length, 0);
});
test("shared options reject missing, foreign, duplicate and unavailable selections", () => {
  assert.throws(() => selectedOptions(main, []));
  assert.throws(() => selectedOptions(main, ["foreign"]));
  assert.throws(() => selectedOptions(main, ["ghee", "ghee"]));
  assert.equal(selectedOptions(main, ["ghee"])[0].price, 30);
});
test("cart links roundtrip configurations and exclude private data and old prices", () => {
  const token = encodeSharedCart([
    {
      slug: "paratha",
      quantity: 2,
      addons: [{ id: "ghee", name: "Ghee", price: 30, groupName: "Style" }],
      notes: "my phone number",
      unitPrice: 1,
    } as never,
  ]);
  assert.deepEqual(decodeSharedCart(token), [
    { slug: "paratha", quantity: 2, addonIds: ["ghee"] },
  ]);
  const raw = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
  assert.ok(!raw.includes("phone"));
  assert.ok(!raw.includes("unitPrice"));
});
test("shared carts reject malformed, oversized, unsupported and injected payloads", () => {
  assert.throws(() => decodeSharedCart("?bad"));
  assert.throws(() => decodeSharedCart("a".repeat(6001)));
  assert.throws(() =>
    encodeSharedCart([{ slug: "../../admin", quantity: 1, addons: [] }]),
  );
  assert.throws(() =>
    encodeSharedCart([{ slug: "chai", quantity: 51, addons: [] }]),
  );
  assert.throws(() =>
    decodeSharedCart(btoa(JSON.stringify({ v: 2, items: [] }))),
  );
});
function order(id: string, other: Partial<InsightOrder> = {}): InsightOrder {
  return {
    id,
    userId: null,
    customerName: "Customer",
    customerPhone: "03001234567",
    status: "DELIVERED",
    paymentStatus: "PAID",
    total: 500,
    createdAt: "2026-11-04T20:30:00.000Z",
    items: [
      {
        productId: "paratha",
        productName: "Paratha",
        quantity: 2,
        lineTotal: 500,
      },
    ],
    ...other,
  };
}
test("insights distinguish delivered value, paid value, outstanding and cancellations", () => {
  const d = buildInsights(
    [
      order("a"),
      order("b", { status: "CANCELLED", total: 5000 }),
      order("c", { status: "PENDING", total: 2000, paymentStatus: "UNPAID" }),
      order("d", { status: "PREPARING", total: 300, paymentStatus: "UNPAID" }),
    ],
    [main],
    Date.parse("2026-11-05T00:00:00Z"),
  );
  assert.equal(d.summary.deliveredValue, 500);
  assert.equal(d.summary.paidValue, 500);
  assert.equal(d.summary.outstanding, 300);
  assert.equal(d.summary.cancellationRate, 25);
  assert.equal(d.menu[0].quantity, 2);
});
test("insight heatmap uses Pakistan time at UTC day boundaries", () => {
  const d = buildInsights([order("a")], [], Date.parse("2026-11-05T00:00:00Z"));
  assert.equal(d.heatmap.find((r) => r.day === "Thu")!.hours[1], 1);
  assert.equal(d.heatmap.find((r) => r.day === "Wed")!.hours[20], 0);
  assert.deepEqual(d.peak, { day: "Thu", hour: 1, orders: 1 });
});
test("customer grouping normalizes Pakistani phone formats without grouping anonymous guests together", () => {
  assert.equal(
    customerKey(order("a")),
    customerKey(order("b", { customerPhone: "+92 300 1234567" })),
  );
  assert.notEqual(
    customerKey(order("a", { customerPhone: "" })),
    customerKey(order("b", { customerPhone: "" })),
  );
});
test("repeat and at-risk segments use delivered orders only", () => {
  const d = buildInsights(
    [order("a"), order("b"), order("cancelled", { status: "CANCELLED" })],
    [],
    Date.parse("2026-12-01T00:00:00Z"),
  );
  assert.equal(d.customers.length, 1);
  assert.equal(d.customers[0].orders, 2);
  assert.equal(d.customers[0].segment, "At risk");
  assert.equal(d.summary.repeatRate, 100);
});
test("empty insights do not invent revenue or peak periods", () => {
  const d = buildInsights([], []);
  assert.equal(d.peak, null);
  assert.equal(d.summary.deliveredValue, 0);
  assert.equal(d.summary.repeatRate, 0);
});
test("kitchen pickup and delivery have distinct valid next steps", () => {
  assert.equal(kitchenNext("READY", "PICKUP"), "DELIVERED");
  assert.equal(kitchenNext("READY", "DELIVERY"), "OUT_FOR_DELIVERY");
  assert.equal(kitchenNext("CANCELLED", "DELIVERY"), null);
  assert.equal(kitchenNext("DELIVERED", "PICKUP"), null);
});
test("ticket timing clamps future orders and shows overdue estimates", () => {
  const now = Date.parse("2026-11-05T00:30:00Z");
  assert.equal(ticketAge("2026-11-05T00:00:00Z", 25, now).overdue, true);
  assert.equal(ticketAge("2026-11-05T01:00:00Z", 25, now).elapsed, 0);
});
test("QR destinations cannot become external or arbitrary routes and campaign data is encoded", () => {
  const link = new URL(
    menuQrUrl("https://esellerstore.vip", "/menu/chai", "counter & cafe"),
  );
  assert.equal(link.searchParams.get("utm_campaign"), "counter & cafe");
  assert.throws(() => menuQrUrl("https://esellerstore.vip", "//evil.test"));
  assert.throws(() => menuQrUrl("https://esellerstore.vip", "/admin"));
  assert.equal(
    escapeMarkup('<script>"x"</script>'),
    "&lt;script&gt;&quot;x&quot;&lt;/script&gt;",
  );
});

test("meal recommendations respect the cafe minimum before discounts", () => {
  assert.equal(
    planMeals([main, drink], { ...preferences, minimum: 541 }).length,
    0,
  );
  assert.equal(
    planMeals([main, drink], { ...preferences, minimum: 540 }).length,
    1,
  );
});
