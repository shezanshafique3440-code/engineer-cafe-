import test from "node:test";
import assert from "node:assert/strict";
import { businessDayStart, businessToday } from "../business-math";
import {
  readSaleIntent,
  saveSaleIntent,
  definiteRejection,
} from "../sale-intent";
test("Pakistan business day includes UTC evening in the following local day", () => {
  assert.equal(businessToday(new Date("2026-11-10T19:00:00Z")), "2026-11-11");
  assert.equal(
    businessDayStart("2026-11-11").toISOString(),
    "2026-11-10T19:00:00.000Z",
  );
  assert.equal(businessToday(new Date("2026-11-10T18:59:59Z")), "2026-11-10");
});
test("Impossible dates cannot broaden a report filter", () => {
  assert.throws(() => businessDayStart("2026-02-30"));
  assert.throws(() => businessDayStart("2026-2-1"));
});
test("Lost authentication or unavailable route does not prove an uncertain sale was rejected", () => {
  for (const status of [0, 401, 403, 404, 409, 429, 500, 503])
    assert.equal(definiteRejection(status), false);
  assert.equal(definiteRejection(422), true);
});
test("Durable request preserves exact payload and cashier across a reload", () => {
  const saved = new Map<string, string>();
  const old = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
    },
  });
  try {
    const intent = {
      ownerId: "cashier-a",
      endpoint: "/api/admin/pos",
      payload: {
        requestId: "same-id",
        lines: [{ productId: "meal", quantity: 2 }],
        cashReceived: 500,
      },
      createdAt: "2026-11-11T08:00:00Z",
    };
    saveSaleIntent("test", intent);
    assert.deepEqual(readSaleIntent("test", "cashier-a"), intent);
    assert.equal(readSaleIntent("test", "cashier-b"), null);
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        setItem() {
          throw Error("Storage full");
        },
      },
    });
    assert.throws(() => saveSaleIntent("test", intent), /Storage full/);
  } finally {
    if (old) Object.defineProperty(globalThis, "localStorage", old);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
