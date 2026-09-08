import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORIES, ADDON_GROUPS, PRODUCTS, COUPONS, SAMPLE_REVIEWS } from "./seed-data";

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function requireEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env before seeding — credentials are never hardcoded.`,
    );
  }
  return value;
}

async function main() {
  console.log("☕ Seeding Engineer Cafe…");

  // ── Settings ──────────────────────────────────────────────────────────────
  await prisma.cafeSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      cafeName: "Engineer Cafe",
      tagline: "Chai. Paratha. Aur Engineering Wali Vibes.",
      phone: "+92 300 1234567",
      whatsapp: process.env.WHATSAPP_NUMBER ?? "923001234567",
      email: "hello@engineercafe.pk",
      address: "Block C, Main Boulevard, Gulberg III, Lahore",
      city: "Lahore",
      mapsQuery: "Main Boulevard Gulberg III, Lahore, Pakistan",
      openingHours: "Mon–Sun · 8:00 AM – 2:00 AM",
      deliveryFee: 80,
      freeDeliveryOver: 1500,
      minOrderAmount: 300,
      taxPercent: 0,
      currency: "PKR",
      currencySymbol: "Rs.",
      instagramUrl: "https://instagram.com/engineercafe.pk",
      facebookUrl: "https://facebook.com/engineercafe.pk",
      codEnabled: true,
      cashAtCounterEnabled: true,
      onlinePaymentEnabled: false,
      isAcceptingOrders: true,
    },
  });

  // ── Users ─────────────────────────────────────────────────────────────────
  const adminEmail = requireEnv("SEED_ADMIN_EMAIL", "admin@engineercafe.pk").toLowerCase();
  const adminPassword = requireEnv("SEED_ADMIN_PASSWORD");
  const customerEmail = requireEnv("SEED_CUSTOMER_EMAIL", "ali@example.com").toLowerCase();
  const customerPassword = requireEnv("SEED_CUSTOMER_PASSWORD");

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: "ADMIN" },
    create: {
      name: "Cafe Admin",
      email: adminEmail,
      phone: "03001234567",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "ADMIN",
    },
  });

  const customerHash = await bcrypt.hash(customerPassword, 12);
  const demoCustomers = [
    { name: "Ali Raza", email: customerEmail, phone: "03011234567" },
    { name: "Hina Tariq", email: "hina@example.com", phone: "03021234567" },
    { name: "Bilal Ahmed", email: "bilal@example.com", phone: "03031234567" },
    { name: "Sana Khalid", email: "sana@example.com", phone: "03041234567" },
  ];

  const customers = [];
  for (const c of demoCustomers) {
    customers.push(
      await prisma.user.upsert({
        where: { email: c.email },
        update: {},
        create: { ...c, passwordHash: customerHash, role: "CUSTOMER" },
      }),
    );
  }
  const primaryCustomer = customers[0];

  await prisma.address.deleteMany({ where: { userId: primaryCustomer.id } });
  await prisma.address.create({
    data: {
      userId: primaryCustomer.id,
      label: "Hostel",
      fullName: "Ali Raza",
      phone: "03011234567",
      addressLine: "Room 214, Boys Hostel 3, University Road",
      area: "Gulberg III",
      city: "Lahore",
      isDefault: true,
    },
  });

  // ── Categories ────────────────────────────────────────────────────────────
  const categoryMap = new Map<string, string>();
  for (const category of CATEGORIES) {
    const record = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        description: category.description,
        image: category.image,
        icon: category.icon,
        sortOrder: category.sortOrder,
        isActive: true,
      },
      create: { ...category, isActive: true },
    });
    categoryMap.set(category.slug, record.id);
  }

  // ── Add-on groups & add-ons ───────────────────────────────────────────────
  const groupMap = new Map<string, string>();
  for (const group of ADDON_GROUPS) {
    const record = await prisma.addonGroup.upsert({
      where: { slug: group.slug },
      update: {
        name: group.name,
        type: group.type,
        isRequired: group.isRequired,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        sortOrder: group.sortOrder,
      },
      create: {
        name: group.name,
        slug: group.slug,
        type: group.type,
        isRequired: group.isRequired,
        minSelect: group.minSelect,
        maxSelect: group.maxSelect,
        sortOrder: group.sortOrder,
      },
    });
    groupMap.set(group.slug, record.id);

    for (const [index, addon] of group.addons.entries()) {
      const existing = await prisma.productAddon.findFirst({
        where: { addonGroupId: record.id, name: addon.name },
      });
      const data = {
        addonGroupId: record.id,
        name: addon.name,
        price: addon.price,
        isDefault: "isDefault" in addon ? Boolean(addon.isDefault) : false,
        sortOrder: index,
      };
      if (existing) {
        await prisma.productAddon.update({ where: { id: existing.id }, data });
      } else {
        await prisma.productAddon.create({ data });
      }
    }
  }

  // ── Products ──────────────────────────────────────────────────────────────
  const productIdByName = new Map<string, string>();
  let created = 0;

  for (const [categorySlug, items] of Object.entries(PRODUCTS)) {
    const categoryId = categoryMap.get(categorySlug);
    if (!categoryId) throw new Error(`Unknown category "${categorySlug}" in seed data.`);

    for (const [index, item] of items.entries()) {
      const slug = slugify(item.name);
      const data: Prisma.ProductUncheckedCreateInput = {
        name: item.name,
        slug,
        description: item.description,
        longDescription: item.longDescription ?? null,
        categoryId,
        price: item.price,
        discountPrice: item.discountPrice ?? null,
        image: item.image,
        isAvailable: true,
        isFeatured: item.isFeatured ?? false,
        isPopular: item.isPopular ?? false,
        isVegetarian: item.isVegetarian ?? false,
        spiceLevel: item.spiceLevel ?? "NONE",
        prepTimeMinutes: item.prepTimeMinutes ?? 10,
        ingredients: item.ingredients,
        calories: item.calories ?? null,
        sortOrder: index,
      };

      const product = await prisma.product.upsert({
        where: { slug },
        update: data,
        create: data,
      });
      productIdByName.set(item.name, product.id);
      created += 1;

      await prisma.addonGroupOnProduct.deleteMany({ where: { productId: product.id } });
      for (const [groupIndex, groupSlug] of (item.addonGroups ?? []).entries()) {
        const addonGroupId = groupMap.get(groupSlug);
        if (!addonGroupId) continue;
        await prisma.addonGroupOnProduct.create({
          data: { productId: product.id, addonGroupId, sortOrder: groupIndex },
        });
      }
    }
  }

  // ── Combo contents (second pass — needs all products to exist) ────────────
  for (const item of PRODUCTS.combos ?? []) {
    const comboId = productIdByName.get(item.name);
    if (!comboId || !item.combo) continue;
    await prisma.comboItem.deleteMany({ where: { comboId } });
    for (const part of item.combo) {
      const productId = productIdByName.get(part.name);
      if (!productId) continue;
      await prisma.comboItem.create({
        data: { comboId, productId, quantity: part.quantity },
      });
    }
  }

  // ── Coupons ───────────────────────────────────────────────────────────────
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  for (const coupon of COUPONS) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {},
      create: { ...coupon, expiresAt: nextYear },
    });
  }

  // ── Reviews ───────────────────────────────────────────────────────────────
  const customerByName = new Map(customers.map((c) => [c.name, c.id]));
  for (const review of SAMPLE_REVIEWS) {
    const productId = productIdByName.get(review.productName);
    const userId = customerByName.get(review.author);
    if (!productId || !userId) continue;
    await prisma.review.upsert({
      where: { productId_userId: { productId, userId } },
      update: { rating: review.rating, comment: review.comment, status: "APPROVED" },
      create: {
        productId,
        userId,
        rating: review.rating,
        comment: review.comment,
        status: "APPROVED",
      },
    });
  }

  // Recompute rating aggregates from approved reviews.
  const grouped = await prisma.review.groupBy({
    by: ["productId"],
    where: { status: "APPROVED" },
    _avg: { rating: true },
    _count: { rating: true },
  });
  for (const row of grouped) {
    await prisma.product.update({
      where: { id: row.productId },
      data: {
        ratingAverage: Math.round((row._avg.rating ?? 0) * 10) / 10,
        ratingCount: row._count.rating,
      },
    });
  }

  // ── Favorites ─────────────────────────────────────────────────────────────
  for (const name of ["Special Engineer Chai", "Loaded Engineer Paratha", "Kashmiri Chai"]) {
    const productId = productIdByName.get(name);
    if (!productId) continue;
    await prisma.favorite.upsert({
      where: { userId_productId: { userId: primaryCustomer.id, productId } },
      update: {},
      create: { userId: primaryCustomer.id, productId },
    });
  }

  // ── A couple of historical orders so the dashboards aren't empty ──────────
  const existingOrders = await prisma.order.count();
  if (existingOrders === 0) {
    const chai = productIdByName.get("Special Engineer Chai");
    const paratha = productIdByName.get("Loaded Engineer Paratha");
    const fries = productIdByName.get("Masala Fries");

    const sampleOrders: {
      number: string;
      status: "DELIVERED" | "PREPARING";
      daysAgo: number;
      items: { id: string | undefined; name: string; slug: string; price: number; qty: number }[];
    }[] = [
      {
        number: "EC1000",
        status: "DELIVERED",
        daysAgo: 5,
        items: [
          { id: chai, name: "Special Engineer Chai", slug: "special-engineer-chai", price: 190, qty: 2 },
          { id: paratha, name: "Loaded Engineer Paratha", slug: "loaded-engineer-paratha", price: 499, qty: 1 },
        ],
      },
      {
        number: "EC1001",
        status: "PREPARING",
        daysAgo: 0,
        items: [
          { id: fries, name: "Masala Fries", slug: "masala-fries", price: 260, qty: 1 },
          { id: chai, name: "Special Engineer Chai", slug: "special-engineer-chai", price: 190, qty: 1 },
        ],
      },
    ];

    for (const sample of sampleOrders) {
      const subtotal = sample.items.reduce((sum, i) => sum + i.price * i.qty, 0);
      const deliveryFee = 80;
      const placedAt = new Date(Date.now() - sample.daysAgo * 86400000);
      await prisma.order.create({
        data: {
          orderNumber: sample.number,
          userId: primaryCustomer.id,
          customerName: primaryCustomer.name,
          customerPhone: "03011234567",
          customerEmail: primaryCustomer.email,
          orderType: "DELIVERY",
          status: sample.status,
          paymentMethod: "CASH_ON_DELIVERY",
          paymentStatus: sample.status === "DELIVERED" ? "PAID" : "UNPAID",
          addressLine: "Room 214, Boys Hostel 3, University Road",
          area: "Gulberg III",
          city: "Lahore",
          subtotal,
          deliveryFee,
          total: subtotal + deliveryFee,
          estimatedMinutes: 35,
          placedAt,
          createdAt: placedAt,
          deliveredAt: sample.status === "DELIVERED" ? placedAt : null,
          items: {
            create: sample.items.map((i) => ({
              productId: i.id ?? null,
              productName: i.name,
              productSlug: i.slug,
              unitPrice: i.price,
              quantity: i.qty,
              lineTotal: i.price * i.qty,
            })),
          },
          events: { create: [{ status: sample.status, note: "Seeded sample order", createdAt: placedAt }] },
        },
      });
    }
  }

  await prisma.contactMessage.createMany({
    data: [
      {
        name: "Usman Sheikh",
        email: "usman@example.com",
        phone: "03051234567",
        subject: "Group booking",
        message: "Do you have space for a 12-person study group on Saturday evening?",
      },
      {
        name: "Ayesha Noor",
        email: "ayesha@example.com",
        subject: "Catering",
        message: "Can you cater 60 cups of chai and parathas for a university hackathon?",
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅ Seed complete — ${created} products, ${CATEGORIES.length} categories, ${COUPONS.length} coupons.`);
  console.log(`   Admin: ${admin.email}`);
  console.log(`   Customer: ${primaryCustomer.email}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
