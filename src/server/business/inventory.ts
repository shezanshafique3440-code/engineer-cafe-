import "server-only";
import type { SessionUser } from "@/lib/types";
import { badRequest } from "@/server/api";
import {
  quantity,
  paise,
  decimal,
  divideRound,
  issueValue,
} from "@/lib/business-math";
import { audit, journal, type DB } from "./core";
export async function moveStock(
  tx: DB,
  actor: SessionUser,
  input: {
    key: string;
    ingredientId: string;
    kind: string;
    delta: bigint;
    incomingValue?: bigint;
    note: string;
    orderId?: string;
    orderItemKey?: string;
    purchaseLineId?: string;
  },
) {
  const prior = await tx.stockMovement.findUnique({
    where: { eventKey: input.key },
  });
  if (prior)
    return {
      cost: paise(prior.value) < 0n ? -paise(prior.value) : paise(prior.value),
      movement: prior,
    };
  const ingredient = await tx.ingredient.findUniqueOrThrow({
    where: { id: input.ingredientId },
  });
  if (!ingredient.isActive) throw badRequest(`${ingredient.name} is inactive.`);
  const before = quantity(ingredient.quantity),
    value = paise(ingredient.stockValue);
  if (input.delta === 0n) throw badRequest("Quantity must change.");
  if (before + input.delta < 0n)
    throw badRequest(
      `Insufficient ${ingredient.name}. Available: ${ingredient.quantity} ${ingredient.unit}.`,
    );
  const reserved = await tx.ingredientReservation.aggregate({
    where: { ingredientId: ingredient.id, consumedAt: null, releasedAt: null },
    _sum: { quantity: true },
  });
  if (
    input.delta < 0n &&
    before + input.delta < quantity(reserved._sum.quantity ?? 0)
  )
    throw badRequest(
      `${ingredient.name} is reserved for open orders. Cancel those tickets before reducing this stock.`,
    );
  const cost =
    input.delta > 0n
      ? (input.incomingValue ?? 0n)
      : issueValue(before, value, -input.delta);
  if (cost < 0n) throw badRequest("Stock value cannot be negative.");
  const change = input.delta > 0n ? cost : -cost;
  await tx.ingredient.update({
    where: { id: ingredient.id },
    data: {
      quantity: decimal(before + input.delta, 4),
      stockValue: decimal(value + change),
    },
  });
  const movement = await tx.stockMovement.create({
    data: {
      eventKey: input.key,
      ingredientId: ingredient.id,
      kind: input.kind,
      quantity: decimal(input.delta, 4),
      value: decimal(change),
      balanceQuantity: decimal(before + input.delta, 4),
      balanceValue: decimal(value + change),
      note: input.note,
      actorName: actor.name,
      orderId: input.orderId,
      orderItemKey: input.orderItemKey,
      purchaseLineId: input.purchaseLineId,
    },
  });
  return { cost, movement };
}
export async function adjustIngredient(
  tx: DB,
  actor: SessionUser,
  data: {
    requestId: string;
    ingredientId: string;
    kind: string;
    quantity: string;
    value?: string;
    note: string;
    date?: string;
  },
) {
  const key = "stock:" + data.requestId;
  const prior = await tx.stockMovement.findUnique({ where: { eventKey: key } });
  if (prior) return prior;
  const ingredient = await tx.ingredient.findUniqueOrThrow({
    where: { id: data.ingredientId },
  });
  let delta = quantity(data.quantity);
  if (data.kind === "COUNT") delta -= quantity(ingredient.quantity);
  else if (["WASTE", "STAFF_MEAL", "OUT"].includes(data.kind)) delta = -delta;
  if (delta === 0n)
    throw badRequest("Count matches recorded stock. No adjustment needed.");
  const added = delta > 0n ? paise(data.value ?? "0") : 0n;
  if (delta > 0n && data.value === undefined)
    throw badRequest("Enter the total cost value of added stock.");
  const { cost, movement } = await moveStock(tx, actor, {
    key,
    ingredientId: ingredient.id,
    kind: data.kind,
    delta,
    incomingValue: added,
    note: data.note,
  });
  const offset =
    data.kind === "OPENING"
      ? "OPENING_EQUITY"
      : ["WASTE", "STAFF_MEAL"].includes(data.kind)
        ? "WASTE"
        : "STOCK_VARIANCE";
  if (cost)
    await journal(tx, actor, {
      key: "journal:" + key,
      source: "STOCK",
      sourceId: movement.id,
      note: data.note,
      date: data.date,
      lines:
        delta > 0n
          ? [
              { code: "INVENTORY", debit: cost },
              { code: offset, credit: cost },
            ]
          : [
              { code: offset, debit: cost },
              { code: "INVENTORY", credit: cost },
            ],
    });
  await audit(tx, actor, "STOCK_" + data.kind, "Ingredient", ingredient.id, {
    quantity: decimal(delta, 4),
    value: decimal(cost),
    note: data.note,
  });
  return movement;
}
export async function reserveOrder(tx: DB, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { addons: true } } },
  });
  if (!order.businessTracked) return;
  const requirements: {
    ingredientId: string;
    quantity: bigint;
    itemKey: string;
  }[] = [];
  for (const item of order.items) {
    if (!item.productId)
      throw badRequest(
        `The recipe for ${item.productName} must be reviewed before preparation.`,
      );
    const product = await tx.product.findUniqueOrThrow({
      where: { id: item.productId },
      include: { recipe: { include: { lines: true } } },
    });
    if (product.recipeRequired && !product.recipe?.lines.length)
      throw badRequest(
        `Add an ingredient recipe for ${product.name} before preparing this order.`,
      );
    const recipes = [];
    if (product.recipe) recipes.push(product.recipe);
    for (const addon of item.addons) {
      if (!addon.addonId) continue;
      const recipe = await tx.recipe.findUnique({
        where: { addonId: addon.addonId },
        include: { lines: true },
      });
      if (recipe) recipes.push(recipe);
    }
    for (const recipe of recipes) {
      if (recipe.reviewRequired)
        throw badRequest(
          "Review the assumed practice recipe and enter actual opening stock before preparing food.",
        );
      const yieldUnits = quantity(recipe.yieldUnits);
      for (const line of recipe.lines) {
        const used = divideRound(
          quantity(line.quantity) * BigInt(item.quantity) * 10000n,
          yieldUnits,
        );
        if (used <= 0n)
          throw badRequest(
            "Recipe quantity is too small for the configured yield.",
          );
        requirements.push({
          ingredientId: line.ingredientId,
          quantity: used,
          itemKey: item.id,
        });
      }
    }
  }
  const combined = new Map<
    string,
    { ingredientId: string; quantity: bigint; itemKey: string }
  >();
  for (const r of requirements) {
    const key = r.itemKey + ":" + r.ingredientId;
    const old = combined.get(key);
    if (old) old.quantity += r.quantity;
    else combined.set(key, { ...r });
  }
  for (const r of combined.values()) {
    const ingredient = await tx.ingredient.findUniqueOrThrow({
      where: { id: r.ingredientId },
    });
    const reserved = await tx.ingredientReservation.aggregate({
      where: {
        ingredientId: r.ingredientId,
        consumedAt: null,
        releasedAt: null,
      },
      _sum: { quantity: true },
    });
    if (
      !ingredient.isActive ||
      quantity(ingredient.quantity) - quantity(reserved._sum.quantity ?? 0) <
        r.quantity
    )
      throw badRequest(
        `Insufficient available ${ingredient.name}. Review your cart or replenish stock.`,
      );
    await tx.ingredientReservation.create({
      data: {
        orderId,
        orderItemKey: r.itemKey,
        ingredientId: r.ingredientId,
        quantity: decimal(r.quantity, 4),
      },
    });
  }
}
export async function consumeOrder(
  tx: DB,
  actor: SessionUser,
  orderId: string,
) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!order.businessTracked || order.businessConsumedAt) return;
  const reservations = await tx.ingredientReservation.findMany({
    where: { orderId, consumedAt: null, releasedAt: null },
    orderBy: { id: "asc" },
  });
  let total = 0n;
  for (const line of reservations) {
    await tx.ingredientReservation.update({
      where: { id: line.id },
      data: { consumedAt: new Date() },
    });
    const result = await moveStock(tx, actor, {
      key: "cook:" + line.id,
      ingredientId: line.ingredientId,
      kind: "PREPARATION",
      delta: -quantity(line.quantity),
      note: `Prepared for #${order.orderNumber}`,
      orderId,
      orderItemKey: line.orderItemKey,
    });
    total += result.cost;
  }
  if (total)
    await journal(tx, actor, {
      key: "cook:" + orderId,
      source: "PREPARATION",
      sourceId: orderId,
      orderId,
      note: `Ingredients issued for #${order.orderNumber}`,
      lines: [
        { code: "WIP", debit: total },
        { code: "INVENTORY", credit: total },
      ],
    });
  await tx.order.update({
    where: { id: orderId },
    data: { businessConsumedAt: new Date() },
  });
  await audit(tx, actor, "PREPARE", "Order", orderId, { cost: decimal(total) });
}
export async function stockReadiness(tx: DB) {
  const [missing, ingredients] = await Promise.all([
    tx.product.findMany({
      where: {
        isAvailable: true,
        recipeRequired: true,
        category: { isActive: true },
        OR: [
          { recipe: null },
          { recipe: { lines: { none: {} } } },
          { recipe: { reviewRequired: true } },
        ],
      },
      select: { id: true, name: true },
    }),
    tx.ingredient.count(),
  ]);
  return {
    missingRecipes: missing,
    ingredients,
    ready: missing.length === 0 && ingredients > 0,
  };
}
