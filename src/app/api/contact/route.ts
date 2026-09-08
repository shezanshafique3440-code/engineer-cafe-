import { prisma } from "@/lib/prisma";
import { contactSchema } from "@/lib/validation";
import { handle, json, parseBody } from "@/server/api";
import { rateLimit } from "@/server/rate-limit";

export const POST = handle(async (request: Request) => {
  rateLimit(request, "contact", 5, 300_000);
  const data = await parseBody(request, contactSchema);

  await prisma.contactMessage.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      subject: data.subject || null,
      message: data.message,
    },
  });

  return json({ ok: true, message: "Thanks! We'll get back to you shortly." }, 201);
});
