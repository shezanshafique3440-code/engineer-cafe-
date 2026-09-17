import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { CATEGORIES, ADDON_GROUPS, PRODUCTS, COUPONS } from "./seed-data";

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
  // On hosted deploys the seed runs on every build. Re-seeding would overwrite
  // prices and menu edits made from the admin panel, so when
  // SEED_ONLY_IF_EMPTY is set we bail out as soon as there is real data.
  if (process.env.SEED_ONLY_IF_EMPTY === "true") {
    const existing = await prisma.product.count();
    if (existing > 0) {
      console.log(`↩︎  Skipping seed — ${existing} products already exist.`);
      return;
    }
  }

  console.log("☕ Seeding Engineer Cafe…");

  // ── Settings ──────────────────────────────────────────────────────────────
  await prisma.cafeSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      cafeName: "Engineer Cafe",
      tagline: "دل چیز ہی کیا… آپ ہماری چائے لیجیے",
      phone: "0340-0511249",
      whatsapp: process.env.WHATSAPP_NUMBER ?? "923400511249",
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
        urduName: item.urduName,
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

  // ── Remove anything no longer on the menu ─────────────────────────────────
  // `db:seed` makes the database match this file. Products that have appeared
  // in an order are archived rather than deleted so order history survives
  // (OrderItem keeps its own copy of the name, price and image).
  const keepSlugs = new Set(
    Object.values(PRODUCTS).flat().map((item) => slugify(item.name)),
  );
  const stale = await prisma.product.findMany({
    where: { slug: { notIn: [...keepSlugs] } },
    select: { id: true, name: true },
  });

  let archived = 0;
  let removed = 0;
  for (const product of stale) {
    const ordered = await prisma.orderItem.count({ where: { productId: product.id } });
    if (ordered > 0) {
      await prisma.product.update({
        where: { id: product.id },
        data: { isAvailable: false, isFeatured: false, isPopular: false },
      });
      archived += 1;
    } else {
      await prisma.product.delete({ where: { id: product.id } });
      removed += 1;
    }
  }

  const keepCategories = new Set(CATEGORIES.map((c) => c.slug));
  const emptyCategories = await prisma.category.findMany({
    where: { slug: { notIn: [...keepCategories] } },
    select: { id: true, slug: true, _count: { select: { products: true } } },
  });
  for (const category of emptyCategories) {
    if (category._count.products === 0) {
      await prisma.category.delete({ where: { id: category.id } });
    } else {
      // Still holds archived products — hide it instead of breaking the link.
      await prisma.category.update({ where: { id: category.id }, data: { isActive: false } });
    }
  }

  if (stale.length > 0) {
    console.log(`   Pruned ${removed} off-menu product(s), archived ${archived} with order history.`);
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

  // ── One-time cleanup of the retired demo reviews ─────────────────────────
  // Earlier seeds shipped fabricated reviews. Deployments created before that
  // changed still hold them, and some re-attach to real menu items that share
  // a name, so they would keep showing as genuine customer feedback. These are
  // matched on their exact seeded text, so nothing a real customer wrote is
  // ever touched. Safe to delete this block once every deployment has run it.
  const RETIRED_DEMO_REVIEWS = [
    "Genuinely the best karak in Gulberg. I finish my whole assignment on one cup.",
    "Ginger and elaichi balance is perfect. Ordered it three days straight.",
    "Needs two hands and a nap afterwards. Worth every rupee.",
    "Very filling, slightly spicy for me but the cheese saves it.",
    "Proper pink chai with real pistachios, not the powdered stuff.",
    "Cheese pull is real. Ask for extra sauce.",
    "Rs. 299 for chai and aloo paratha — nothing else comes close near campus.",
    "Ordered at 1:40 AM, arrived hot at 2:05. Legends.",
    "Good masala, keep the garlic mayo coming.",
    "Strong enough to fix a production bug.",
    "My little sister now refuses every other dessert.",
    "Crispy and juicy, bun could be a touch fresher.",
  ];
  const purged = await prisma.review.deleteMany({
    where: { comment: { in: RETIRED_DEMO_REVIEWS } },
  });
  if (purged.count > 0) {
    console.log(`   Removed ${purged.count} retired demo review(s).`);
    const touched = await prisma.product.findMany({ select: { id: true } });
    for (const product of touched) {
      const agg = await prisma.review.aggregate({
        where: { productId: product.id, status: "APPROVED" },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await prisma.product.update({
        where: { id: product.id },
        data: {
          ratingAverage: Math.round((agg._avg.rating ?? 0) * 10) / 10,
          ratingCount: agg._count.rating,
        },
      });
    }
  }

  // ── Favorites ─────────────────────────────────────────────────────────────
  for (const name of ["Sada Chai", "Chicken Cheese Paratha", "Kashmiri Chai"]) {
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
    const chai = productIdByName.get("Sada Chai");
    const paratha = productIdByName.get("Chicken Cheese Paratha");
    const anda = productIdByName.get("Half Fry");

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
          { id: chai, name: "Sada Chai", slug: "sada-chai", price: 90, qty: 2 },
          { id: paratha, name: "Chicken Cheese Paratha", slug: "chicken-cheese-paratha", price: 350, qty: 1 },
        ],
      },
      {
        number: "EC1001",
        status: "PREPARING",
        daysAgo: 0,
        items: [
          { id: anda, name: "Half Fry", slug: "half-fry", price: 80, qty: 2 },
          { id: chai, name: "Sada Chai", slug: "sada-chai", price: 90, qty: 1 },
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
