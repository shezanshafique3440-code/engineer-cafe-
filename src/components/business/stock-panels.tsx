"use client";
import { decimal, divideRound, paise } from "@/lib/business-math";
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
    [task, setTask] = useState("list");
  const { user } = useSession();
  const edit = canBusiness(user, "inventory"),
    items = rows(data, "ingredients");
  const done = () => {
    setEditing(null);
    setAdjusting(null);
    setTask("list");
    reload();
  };
  return (
    <div className="space-y-5">
      <Notice>
        Stock is kept in grams (g), millilitres (mL) or pieces. 1 kg = 1,000 g;
        1 litre = 1,000 mL. Open orders reserve ingredients; cooking consumes
        them.
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
              fields={[
                {
                  name: "name",
                  label: "Ingredient",
                  value: text(editing ?? undefined, "name"),
                },
                {
                  name: "unit",
                  label: "Stock unit",
                  type: "select",
                  options: [
                    { value: "G", label: "Grams (g)" },
                    { value: "ML", label: "Millilitres (mL)" },
                    { value: "PCS", label: "Pieces" },
                  ],
                  value: text(editing ?? undefined, "unit", "G"),
                },
                {
                  name: "reorderAt",
                  label: "Low-stock alert quantity",
                  type: "number",
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
              description="A stock count is the actual total counted; other actions use the quantity added or removed. Explain waste, staff meals and corrections."
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
                  label: "Quantity in the stock unit",
                  type: "number",
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
      <div
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Available stock"
      >
        {items.map((i) => (
          <article key={text(i, "id")} className="surface p-4">
            <h2 className="font-bold">{text(i, "name")}</h2>
            <p className="mt-2 text-xl font-bold">
              {text(i, "available")}{" "}
              <span className="text-sm">{text(i, "unit")}</span>
            </p>
            <p className="mt-1 text-xs text-charcoal-500">
              Available · On hand {text(i, "quantity")} · Reserved{" "}
              {text(i, "reserved")}
            </p>
            {Boolean(i.low) && (
              <p className="mt-2 font-bold text-chilli-600">Low stock</p>
            )}
            {!i.isActive && <p className="text-sm">Inactive</p>}
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
}: {
  ingredients: Row[];
  lines: IngredientLine[];
  setLines: (value: IngredientLine[]) => void;
  cost?: boolean;
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
          className="grid items-end gap-3 rounded-xl border border-cream-200 p-3 sm:grid-cols-[2fr_1fr_1fr_auto]"
        >
          <Select
            label="Ingredient"
            required
            value={line.ingredientId}
            onChange={(e) => set(i, "ingredientId", e.target.value)}
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
          <Input
            label="Quantity (stock unit)"
            type="number"
            required
            min="0.0001"
            step="0.0001"
            value={line.quantity}
            onChange={(e) => set(i, "quantity", e.target.value)}
          />
          {cost ? (
            <Input
              label="Line total (Rs.)"
              type="number"
              required
              min="0"
              step="0.01"
              value={line.totalCost}
              onChange={(e) => set(i, "totalCost", e.target.value)}
            />
          ) : (
            <div />
          )}
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
    rows(recipe, "lines").map((l) => ({
      ingredientId: text(l, "ingredientId"),
      quantity: text(l, "quantity"),
      totalCost: "",
    })),
  );
  return (
    <Form
      title={(recipe.reviewRequired ? "Review required · " : "Recipe · ") + text(item, "name")}
      module="recipes"
      fields={[
        {
          name: "yieldUnits",
          label: "Portions made by this batch",
          type: "number",
          min: "0.0001",
          step: "0.0001",
          value: text(recipe, "yieldUnits", "1"),
        },
        {
          name: "note",
          label: "Recipe note",
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
        lines: lines.map((l) => ({
          ingredientId: l.ingredientId,
          quantity: l.quantity,
        })),
      })}
      onDone={reload}
      submitLabel="Save recipe"
    >
      {() => (
        <LineEditor
          ingredients={ingredients}
          lines={lines}
          setLines={setLines}
        />
      )}
    </Form>
  );
}
