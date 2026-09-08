import { prisma } from "@/lib/prisma";
import { addressSchema } from "@/lib/validation";
import { handle, json, notFound, parseBody, requireUser } from "@/server/api";

async function ownedAddress(userId: string, id: string) {
  const address = await prisma.address.findFirst({ where: { id, userId } });
  if (!address) throw notFound("Address not found.");
  return address;
}

export const PUT = handle(
  async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    await ownedAddress(user.id, id);
    const data = await parseBody(request, addressSchema);

    if (data.isDefault) {
      await prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    }

    const address = await prisma.address.update({
      where: { id },
      data: {
        label: data.label,
        fullName: data.fullName,
        phone: data.phone,
        addressLine: data.addressLine,
        area: data.area || null,
        city: data.city,
        notes: data.notes || null,
        isDefault: data.isDefault,
      },
    });
    return json({ address });
  },
);

export const DELETE = handle(
  async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireUser();
    const { id } = await ctx.params;
    await ownedAddress(user.id, id);
    await prisma.address.delete({ where: { id } });
    return json({ ok: true });
  },
);
