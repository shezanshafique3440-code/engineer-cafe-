import test from "node:test";
import assert from "node:assert/strict";
import {
  toStockQuantity,
  fromStockQuantity,
  stockAmount,
} from "../stock-units";
test("Shop quantities convert exactly without changing the stored stock measure", () => {
  assert.equal(toStockQuantity("2", "KG", "G"), "2000");
  assert.equal(toStockQuantity("1.5", "L", "ML"), "1500");
  assert.equal(toStockQuantity("12", "PCS", "PCS"), "12");
  assert.equal(toStockQuantity("0.0000001", "KG", "G"), "0.0001");
  assert.equal(toStockQuantity("0.1", "KG", "G"), "100");
  assert.equal(toStockQuantity("0.25", "L", "ML"), "250");
});
test("Changing displayed unit keeps the canonical quantity, including fine recipe measurements", () => {
  for (const base of ["G", "ML"])
    for (const raw of [
      "0",
      "0.0001",
      "2.3456",
      "1000",
      "12500.55",
      "999999999999.9999",
    ]) {
      const large = base === "G" ? "KG" : "L";
      assert.equal(
        toStockQuantity(fromStockQuantity(raw, large), large, base),
        toStockQuantity(raw, base as "G" | "ML", base),
      );
    }
});
test("Wrong measures, excess precision, negatives and too-large converted stock cannot be submitted", () => {
  for (const input of [
    ["1", "KG", "ML"],
    ["1", "L", "G"],
    ["-2", "G", "G"],
    ["1e4", "G", "G"],
    ["0.00001", "G", "G"],
    ["999999999999", "KG", "G"],
  ] as const)
    assert.throws(() => toStockQuantity(...input));
});
test("Stock cards show familiar units without rounding away small quantities", () => {
  assert.equal(stockAmount("2000", "G"), "2 kg");
  assert.equal(stockAmount("1500", "ML"), "1.5 L");
  assert.equal(stockAmount("0.0001", "G"), "0.0001 g");
  assert.equal(stockAmount("12", "PCS"), "12 pcs");
});
