import { prisma } from "@/lib/prisma";
import { addressSchema } from "@/lib/validation";
import { handle, json, parseBody, requireUser } from "@/server/api";

export const GET = handle(async () => {
  const user = await requireUser();
  const addresses = await prisma.address.findMany({
    where: { userId: user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return json({ addresses });
});

export const POST = handle(async (request: Request) => {
  const user = await requireUser();
  const data = await parseBody(request, addressSchema);

  const count = await prisma.address.count({ where: { userId: user.id } });
  const isDefault = data.isDefault || count === 0;

  if (isDefault) {
    await prisma.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  }

  const address = await prisma.address.create({
    data: {
      userId: user.id,
      label: data.label,
      fullName: data.fullName,
      phone: data.phone,
      addressLine: data.addressLine,
      area: data.area || null,
      city: data.city,
      notes: data.notes || null,
      isDefault,
    },
  });
  return json({ address }, 201);
});
