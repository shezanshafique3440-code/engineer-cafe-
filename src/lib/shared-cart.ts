import { z } from "zod";
import type { CartLine } from "./types";
const sharedSchema = z
  .object({
    v: z.literal(1),
    items: z
      .array(
        z
          .object({
            slug: z
              .string()
              .min(1)
              .max(150)
              .regex(/^[a-z0-9-]+$/),
            quantity: z.number().int().min(1).max(50),
            addonIds: z.array(z.string().min(1).max(100)).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();
export type SharedItem = z.infer<typeof sharedSchema>["items"][number];
export function encodeSharedCart(
  lines: Pick<CartLine, "slug" | "quantity" | "addons">[],
): string {
  const payload = sharedSchema.parse({
    v: 1,
    items: lines.map((line) => ({
      slug: line.slug,
      quantity: line.quantity,
      addonIds: line.addons.map((a) => a.id),
    })),
  });
  const encoded = btoa(
    String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  if (encoded.length > 6000)
    throw new Error(
      "This cart is too large to share. Use up to 20 items with fewer options.",
    );
  return encoded;
}
export function decodeSharedCart(token: string): SharedItem[] {
  if (!token || token.length > 6000 || !/^[a-zA-Z0-9_-]+$/.test(token))
    throw new Error("This shared cart link is invalid.");
  try {
    const raw = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    return sharedSchema.parse(
      JSON.parse(
        new TextDecoder().decode(Uint8Array.from(raw, (c) => c.charCodeAt(0))),
      ),
    ).items;
  } catch {
    throw new Error("This shared cart link is invalid or no longer supported.");
  }
}
