"use client";
import { decimal, divideRound, paise, quantity } from "@/lib/business-math";
import Link from "next/link";
import { useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import { canBusiness } from "@/lib/business-access";
import { useSession } from "@/context/session-context";
import {
  Form,
  Table,
  Cell,
  Notice,
  text,
  rows,
  object,
  money,
  day,
  type Row,
  type Field,
} from "./shared";
import { StockQuantityInput } from "./stock-quantity-input";
import { stockAmount } from "@/lib/stock-units";
const noteField: Field = {
  name: "note",
  label: "Reason / reference",
  required: true,
};
export function IngredientsPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const [editing, setEditing] = useState<Row | null>(null),
    [adjusting, setAdjusting] = useState<Row | null>(null),
    [task, setTask] = useState("list"),
    [search, setSearch] = useState(""),
    [lowOnly, setLowOnly] = useState(false);
  const { user } = useSession();
  const edit = canBusiness(user, "inventory"),
    items = rows(data, "ingredients");
  const visibleItems = items.filter(
    (i) =>
      text(i, "name").toLowerCase().includes(search.trim().toLowerCase()) &&
      (!lowOnly || Boolean(i.low)),
  );
  const done = () => {
    setEditing(null);
    setAdjusting(null);
    setTask("list");
    reload();
  };
  return (
    <div className="space-y-5">
      <Notice>
        Start with Add ingredient, receive the supplier delivery in Purchases,
        then set how much each menu item uses in Recipes. Enter kg, litres or
        pieces; conversion is automatic.
      </Notice>
      <div className="flex flex-wrap gap-2" aria-label="Stock actions">
        <Button
          variant={task === "list" ? "primary" : "secondary"}
          onClick={() => setTask("list")}
        >
          Stock list
        </Button>
        {edit && (
          <>
            <Button
              variant={task === "add" ? "primary" : "secondary"}
              onClick={() => {
                setEditing(null);
                setTask("add");
              }}
            >
              Add ingredient
            </Button>
            <Button
              variant={task === "adjust" ? "primary" : "secondary"}
              onClick={() => setTask("adjust")}
            >
              Waste / stock adjustment
            </Button>
            <Link
              className="btn-secondary"
              href="/admin/business?section=purchases"
            >
              Receive purchases
            </Link>
            <Link
              className="btn-secondary"
              href="/admin/business?section=recipes"
            >
              Set menu recipes
            </Link>
          </>
        )}
      </div>
      {edit && task !== "list" && (
        <div className="grid gap-5 xl:grid-cols-2">
          {task === "add" && (
            <Form
              key={text(editing ?? undefined, "id", "new")}
              module="ingredients"
              title={editing ? "Edit ingredient" : "Add ingredient"}
              description="Example: Flour → Weight → alert at 2 kg. Save the ingredient here; receive purchased quantities in Purchases."
              submitLabel="Save ingredient"
              successMessage="Ingredient saved. Receive its stock in Purchases, then add it to a recipe."
              fields={[
                {
                  name: "name",
                  label: "Ingredient",
                  placeholder: "e.g. Flour, milk or eggs",
                  value: text(editing ?? undefined, "name"),
                },
                {
                  name: "unit",
                  label: "How is it measured?",
                  disabled: Boolean(editing),
                  hint: editing
                    ? "The stock measure stays fixed to preserve quantities and history."
                    : "Weight for flour/meat; liquid for milk/oil; pieces for eggs/bottles.",
                  type: "select",
                  options: [
                    { value: "G", label: "Weight — kg / grams" },
                    { value: "ML", label: "Liquid — litres / mL" },
                    { value: "PCS", label: "Pieces" },
                  ],
                  value: text(editing ?? undefined, "unit", "G"),
                },
                {
                  name: "reorderAt",
                  label: "Low-stock alert quantity",
                  type: "quantity",
                  stockUnit: (v) => String(v.unit),
                  preferLarge: true,
                  value: text(editing ?? undefined, "reorderAt", "0"),
                  min: "0",
                  step: "0.0001",
                },
                {
                  name: "isActive",
                  label: "Active",
                  type: "checkbox",
                  value: editing ? Boolean(editing.isActive) : true,
                },
              ]}
              build={(v) => ({
                ...v,
                action: "SAVE",
                id: editing?.id,
                version: editing?.version,
              })}
              onDone={done}
            />
          )}
          {task === "adjust" && (
            <Form
              key={"adjust:" + text(adjusting ?? undefined, "id", "new")}
              module="ingredients"
              title="Opening stock / stock adjustment"
              description="Choose the ingredient and what happened. Waste removes the amount entered; a physical count replaces the recorded total. Supplier deliveries belong in Purchases."
              submitLabel="Review stock change"
              review={(v) => (
                <div className="space-y-2 text-sm">
                  <p>
                    <strong>
                      {text(
                        items.find((i) => i.id === v.ingredientId),
                        "name",
                      )}
                    </strong>{" "}
                    · {String(v.kind).replaceAll("_", " ")}
                  </p>
                  <p>
                    {v.kind === "COUNT"
                      ? "Actual counted total"
                      : "Quantity to " +
                        (["WASTE", "OUT", "STAFF_MEAL"].includes(String(v.kind))
                          ? "remove"
                          : "add")}
                    :{" "}
                    <strong>
                      {stockAmount(
                        String(v.quantity),
                        text(
                          items.find((i) => i.id === v.ingredientId),
                          "unit",
                        ),
                      )}
                    </strong>
                  </p>
                  <p>
                    Date: {String(v.date)} · Reason: {String(v.note)}
                  </p>
                  {["OPENING", "IN", "COUNT"].includes(String(v.kind)) && (
                    <p>Cost value for added stock: {money(v.value)}</p>
                  )}
                </div>
              )}
              fields={[
                {
                  name: "ingredientId",
                  label: "Ingredient",
                  type: "select",
                  options: items.map((i) => ({
                    value: text(i, "id"),
                    label: text(i, "name") + " · " + text(i, "unit"),
                  })),
                  value: text(adjusting ?? undefined, "id"),
                },
                {
                  name: "kind",
                  label: "Action",
                  type: "select",
                  options: [
                    ...(!data.integrationActive
                      ? [{ value: "OPENING", label: "Opening stock" }]
                      : []),
                    {
                      value: "COUNT",
                      label: "Physical stock count",
                    },
                    { value: "WASTE", label: "Waste / spoilage" },
                    {
                      value: "STAFF_MEAL",
                      label: "Staff meal / complimentary use",
                    },
                    { value: "IN", label: "Stock found / other receipt" },
                    { value: "OUT", label: "Other stock removal" },
                  ],
                  value: !data.integrationActive ? "OPENING" : "WASTE",
                },
                {
                  name: "quantity",
                  label: "Quantity",
                  type: "quantity",
                  stockUnit: (v) =>
                    text(
                      items.find((i) => i.id === v.ingredientId),
                      "unit",
                      "G",
                    ),
                  preferLarge: true,
                  min: "0",
                  step: "0.0001",
                },
                {
                  name: "value",
                  label: "Total cost value of stock added (Rs.)",
                  visible: (v) =>
                    ["OPENING", "IN", "COUNT"].includes(String(v.kind)),
                  type: "number",
                  min: "0",
                  value: "0",
                  hint: "Used for opening stock and positive adjustments. Use the purchase screen for supplier deliveries.",
                },
                {
                  name: "date",
                  label: "Accounting date",
                  type: "date",
                  value: text(data, "today"),
                },
                noteField,
              ]}
              build={(v) => ({
                ...v,
                action: "ADJUST",
                version: text(
                  items.find((i) => i.id === v.ingredientId),
                  "version",
                ),
              })}
              onDone={done}
            />
          )}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <Input
            label="Find an ingredient"
            placeholder="Search flour, milk, eggs…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant={lowOnly ? "primary" : "secondary"}
          aria-pressed={lowOnly}
          onClick={() => setLowOnly((v) => !v)}
        >
          Low stock only
        </Button>
      </div>
      {!visibleItems.length && (
        <p className="surface p-5">
          {items.length
            ? "No ingredients match. Clear the search or low-stock filter."
            : "No ingredients yet. Choose Add ingredient to create your first one, then receive stock in Purchases."}
        </p>
      )}
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Available stock"
      >
        {visibleItems.map((i) => (
          <article key={text(i, "id")} className="surface p-4">
            <h2 className="font-bold">{text(i, "name")}</h2>
            <p className="mt-2 text-xl font-bold">
              {stockAmount(text(i, "available"), text(i, "unit"))}
            </p>
            <p className="mt-1 text-xs text-charcoal-500">
              Available · On hand{" "}
              {stockAmount(text(i, "quantity"), text(i, "unit"))} · Reserved{" "}
              {stockAmount(text(i, "reserved"), text(i, "unit"))}
            </p>
            {Boolean(i.low) && (
              <p className="mt-2 font-bold text-chilli-600">Low stock</p>
            )}
            {!i.isActive && <p className="text-sm">Inactive</p>}
            {edit && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setEditing(i);
                    setTask("add");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Edit ingredient
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setAdjusting(i);
                    setTask("adjust");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Record waste / count
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
      <details className="surface p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-bold">
          Detailed stock / Edit ingredient
        </summary>
        <Table
          headers={[
            "Ingredient",
            "On hand",
            "Reserved",
            "Available",
            "Unit",
            "Stock value",
            "Reorder at",
            ...(edit ? ["Actions"] : []),
          ]}
          empty={!items.length}
        >
          {items.map((i) => (
            <tr key={text(i, "id")}>
              <Cell>
                <strong>{text(i, "name")}</strong>
                {Boolean(i.low) && (
                  <span className="mt-1 block text-xs font-semibold text-chilli-600">
                    Low stock
                  </span>
                )}
                {!i.isActive && <span className="block text-xs">Inactive</span>}
              </Cell>
              <Cell>{text(i, "quantity")}</Cell>
              <Cell>{text(i, "reserved")}</Cell>
              <Cell>{text(i, "available")}</Cell>
              <Cell>{text(i, "unit")}</Cell>
              <Cell>{edit ? money(i.stockValue) : "—"}</Cell>
              <Cell>{text(i, "reorderAt")}</Cell>
              {edit && (
                <Cell>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditing(i);
                        setTask("add");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setAdjusting(i);
                        setTask("adjust");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Adjust
                    </Button>
                  </div>
                </Cell>
              )}
            </tr>
          ))}
        </Table>
      </details>
      <details className="surface p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-bold">
          Stock movement history
        </summary>
        <h2 className="text-xl font-bold">Latest stock movements</h2>
        <Table
          headers={[
            "When",
            "Ingredient",
            "Action",
            "Quantity",
            "Value",
            "Balance",
            "Recorded by",
          ]}
          empty={!rows(data, "movements").length}
        >
          {rows(data, "movements").map((m) => (
            <tr key={text(m, "id")}>
              <Cell>{day(m.createdAt)}</Cell>
              <Cell>{text(m, "ingredient.name")}</Cell>
              <Cell>{text(m, "kind")}</Cell>
              <Cell>{text(m, "quantity")}</Cell>
              <Cell>{edit ? money(m.value) : "—"}</Cell>
              <Cell>{text(m, "balanceQuantity")}</Cell>
              <Cell>
                {text(m, "actorName")}
                <span className="block text-xs text-charcoal-500">
                  {text(m, "note")}
                </span>
              </Cell>
            </tr>
          ))}
        </Table>
      </details>
    </div>
  );
}
export type IngredientLine = {
  ingredientId: string;
  quantity: string;
  totalCost: string;
};
export function LineEditor({
  ingredients,
  lines,
  setLines,
  cost = false,
  required = true,
}: {
  ingredients: Row[];
  lines: IngredientLine[];
  setLines: (value: IngredientLine[]) => void;
  cost?: boolean;
  required?: boolean;
}) {
  const set = (i: number, key: keyof IngredientLine, value: string) =>
    setLines(
      lines.map((r, index) => (index === i ? { ...r, [key]: value } : r)),
    );
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold">
        {cost ? "Invoice lines" : "Ingredients per recipe batch"}
      </p>
      {lines.map((line, i) => (
        <div
          key={i}
          className={
            "grid items-end gap-3 rounded-xl border border-cream-200 p-3 " +
            (cost
              ? "lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)_auto]"
              : "lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto]")
          }
        >
          <Select
            label="Ingredient"
            required={required || Boolean(line.quantity)}
            value={line.ingredientId}
            onChange={(e) =>
              setLines(
                lines.map((r, index) =>
                  index === i
                    ? {
                        ingredientId: e.target.value,
                        quantity: "",
                        totalCost: "",
                      }
                    : r,
                ),
              )
            }
          >
            <option value="">Choose…</option>
            {ingredients.map((ingredient) => (
              <option
                key={text(ingredient, "id")}
                value={text(ingredient, "id")}
              >
                {text(ingredient, "name")} · {text(ingredient, "unit")}
              </option>
            ))}
          </Select>
          <StockQuantityInput
            key={line.ingredientId}
            label="Quantity"
            base={text(
              ingredients.find((r) => r.id === line.ingredientId),
              "unit",
              "G",
            )}
            value={line.quantity}
            onChange={(value) => set(i, "quantity", value)}
            min="0.0001"
            required={required || Boolean(line.ingredientId)}
            preferLarge={cost}
          />
          {cost ? (
            <Input
              label="Line total (Rs.)"
              hint="Total paid/owed for this whole ingredient line, not the price per kg or litre."
              type="number"
              required
              min="0"
              step="0.01"
              value={line.totalCost}
              onChange={(e) => set(i, "totalCost", e.target.value)}
            />
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setLines(lines.filter((_, index) => index !== i))}
            aria-label={`Remove ingredient line ${i + 1}`}
          >
            Remove
          </Button>
        </div>
      ))}
      {!lines.length && (
        <p className="text-sm text-charcoal-500">
          Add an ingredient line to continue.
        </p>
      )}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          setLines([
            ...lines,
            { ingredientId: "", quantity: "", totalCost: "" },
          ])
        }
      >
        Add ingredient line
      </Button>
    </div>
  );
}
export function RecipesPanel({
  data,
  reload,
}: {
  data: Row;
  reload: () => void;
}) {
  const [margin, setMargin] = useState("65"),
    [target, setTarget] = useState(""),
    [kind, setKind] = useState<"products" | "addons">("products");
  const selected =
    rows(data, kind).find((p) => p.id === target) ?? rows(data, kind)[0];
  return (
    <div className="space-y-5">
      <Notice>
        Set the quantity used for a complete batch and its yield. Example: 1,000
        g flour for 10 parathas means 100 g per sale. Recipe edits affect new
        orders; existing reservations and historical costs keep their snapshots.
      </Notice>
      <div className="grid gap-3 sm:grid-cols-2">
        <Select
          label="Recipe for"
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as typeof kind);
            setTarget("");
          }}
        >
          <option value="products">Menu product</option>
          <option value="addons">Add-on / customisation</option>
        </Select>
        <Select
          label="Choose item"
          value={selected ? text(selected, "id") : ""}
          onChange={(e) => setTarget(e.target.value)}
        >
          {rows(data, kind).map((p) => (
            <option value={text(p, "id")} key={text(p, "id")}>
              {text(p, "name")}
            </option>
          ))}
        </Select>
      </div>
      {selected && (
        <RecipeEditor
          key={kind + text(selected, "id") + text(selected, "recipe.updatedAt")}
          item={selected}
          kind={kind}
          ingredients={rows(data, "ingredients")}
          reload={reload}
        />
      )}
      <details className="surface p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-bold">
          Recipe costs & price suggestions
        </summary>
        <Input
          label="Target ingredient margin (%)"
          hint="Cost-based suggestion only; overheads and tax are excluded. Selling prices change only through Products."
          type="number"
          min="0"
          max="95"
          step="1"
          value={margin}
          onChange={(e) => setMargin(e.target.value)}
        />
        <Table
          headers={[
            "Menu item",
            "Selling price",
            "Estimated ingredient cost",
            "Ingredient margin",
            "Suggested price at target",
            "Tracking",
          ]}
          empty={!rows(data, "products").length}
        >
          {rows(data, "products").map((p) => (
            <tr key={text(p, "id")}>
              <Cell>{text(p, "name")}</Cell>
              <Cell>{money(p.sellingPrice)}</Cell>
              <Cell>
                {p.estimatedCost === null
                  ? "Needs stock / recipe"
                  : money(p.estimatedCost)}
              </Cell>
              <Cell>
                {p.estimatedCost === null || Number(p.sellingPrice) <= 0
                  ? "—"
                  : decimal(
                      divideRound(
                        (BigInt(Number(p.sellingPrice)) * 100n -
                          paise(text(p, "estimatedCost"))) *
                          10000n,
                        BigInt(Number(p.sellingPrice)) * 100n,
                      ),
                    ) + "%"}
              </Cell>
              <Cell>
                {p.estimatedCost === null ||
                !/^\d{1,2}$/.test(margin) ||
                Number(margin) > 95
                  ? "—"
                  : money(
                      decimal(
                        (paise(text(p, "estimatedCost")) * 100n +
                          BigInt(100 - Number(margin)) -
                          1n) /
                          BigInt(100 - Number(margin)),
                      ),
                    )}
              </Cell>
              <Cell>
                {p.recipeRequired
                  ? "Recipe required"
                  : "Service / no ingredients"}
              </Cell>
            </tr>
          ))}
        </Table>
      </details>
    </div>
  );
}
function RecipeEditor({
  item,
  kind,
  ingredients,
  reload,
}: {
  item: Row;
  kind: string;
  ingredients: Row[];
  reload: () => void;
}) {
  const recipe = object(item, "recipe");
  const [lines, setLines] = useState<IngredientLine[]>(() =>
    (rows(recipe, "lines").length
      ? rows(recipe, "lines")
      : [{ ingredientId: "", quantity: "" }]
    ).map((l) => ({
      ingredientId: text(l, "ingredientId"),
      quantity: text(l, "quantity"),
      totalCost: "",
    })),
  );
  return (
    <Form
      title={
        (recipe.reviewRequired ? "Review required · " : "Recipe · ") +
        text(item, "name")
      }
      module="recipes"
      description="Choose the quantities used for one portion, or enter a batch and how many portions it makes. Example: 1 kg flour for 10 portions = 100 g per sale."
      review={(v) => {
        if (
          (v.required && !lines.some((l) => l.ingredientId && l.quantity)) ||
          lines.some((l) => Boolean(l.ingredientId) !== Boolean(l.quantity))
        )
          throw Error("Add an ingredient and quantity for each recipe line.");
        return (
          <div className="space-y-2 text-sm">
            <p>
              <strong>{text(item, "name")}</strong> · makes{" "}
              {String(v.yieldUnits)} portions
            </p>
            {lines
              .filter((l) => l.ingredientId && l.quantity)
              .map((l, i) => (
                <p key={i}>
                  {text(
                    ingredients.find((r) => r.id === l.ingredientId),
                    "name",
                  )}
                  :{" "}
                  {stockAmount(
                    l.quantity,
                    text(
                      ingredients.find((r) => r.id === l.ingredientId),
                      "unit",
                    ),
                  )}{" "}
                  per batch. For one sale:{" "}
                  {stockAmount(
                    decimal(
                      divideRound(
                        quantity(l.quantity) * 10000n,
                        quantity(String(v.yieldUnits)),
                      ),
                      4,
                    ),
                    text(
                      ingredients.find((r) => r.id === l.ingredientId),
                      "unit",
                    ),
                  )}
                  .
                </p>
              ))}
            <p>
              New sales use this recipe. Existing orders keep their original
              quantities and costs.
            </p>
          </div>
        );
      }}
      fields={[
        {
          name: "yieldUnits",
          label: "Portions made by this batch",
          type: "number",
          min: "0.0001",
          step: "0.0001",
          value: text(recipe, "yieldUnits", "1"),
          hint: "Keep 1 when entering ingredients for a single plate or cup.",
        },
        {
          name: "note",
          label: "Recipe note",
          advanced: true,
          required: false,
          value: text(recipe, "note"),
        },
        {
          name: "required",
          label: "Track ingredient consumption",
          type: "checkbox",
          value: kind === "addons" || Boolean(item.recipeRequired),
          hint: "Only mark non-food services such as packing as not requiring ingredients.",
        },
      ]}
      build={(v) => ({
        ...v,
        ...(kind === "products"
          ? { productId: item.id }
          : { addonId: item.id }),
        version: recipe.updatedAt,
        lines: lines
          .filter((l) => l.ingredientId || l.quantity)
          .map((l) => ({
            ingredientId: l.ingredientId,
            quantity: l.quantity,
          })),
      })}
      onDone={reload}
      submitLabel="Save recipe"
    >
      {(v) => (
        <LineEditor
          ingredients={ingredients}
          lines={lines}
          setLines={setLines}
          required={Boolean(v.required)}
        />
      )}
    </Form>
  );
}
