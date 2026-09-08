import { z } from "zod";

const phoneRegex = /^(\+?92|0)?3\d{9}$/;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required.")
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .max(72, "Password is too long.");

export const phoneSchema = z
  .string()
  .trim()
  .regex(phoneRegex, "Enter a valid Pakistani mobile number (e.g. 03001234567).");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(60),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(60),
  phone: phoneSchema.optional().or(z.literal("")),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: passwordSchema,
});

export const addressSchema = z.object({
  label: z.string().trim().min(1).max(30).default("Home"),
  fullName: z.string().trim().min(2, "Enter the recipient name.").max(60),
  phone: phoneSchema,
  addressLine: z.string().trim().min(8, "Enter a complete street address.").max(200),
  area: z.string().trim().max(80).optional().or(z.literal("")),
  city: z.string().trim().min(2, "City is required.").max(60),
  notes: z.string().trim().max(200).optional().or(z.literal("")),
  isDefault: z.boolean().default(false),
});

export const cartLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1, "Quantity must be at least 1.").max(50),
  addonIds: z.array(z.string().min(1)).max(20).default([]),
  notes: z.string().trim().max(200).optional(),
});

export const quoteSchema = z.object({
  lines: z.array(cartLineSchema).max(60),
  couponCode: z.string().trim().max(32).optional().or(z.literal("")),
  orderType: z.enum(["DELIVERY", "PICKUP"]).default("DELIVERY"),
});

export const checkoutSchema = z.object({
  lines: z.array(cartLineSchema).min(1, "Your cart is empty.").max(60),
  couponCode: z.string().trim().max(32).optional().or(z.literal("")),
  orderType: z.enum(["DELIVERY", "PICKUP"]),
  paymentMethod: z.enum(["CASH_ON_DELIVERY", "CASH_AT_COUNTER", "ONLINE"]),
  customerName: z.string().trim().min(2, "Please enter your full name.").max(60),
  customerPhone: phoneSchema,
  customerEmail: emailSchema.optional().or(z.literal("")),
  addressLine: z.string().trim().max(200).optional().or(z.literal("")),
  area: z.string().trim().max(80).optional().or(z.literal("")),
  city: z.string().trim().max(60).optional().or(z.literal("")),
  instructions: z.string().trim().max(300).optional().or(z.literal("")),
  saveAddress: z.boolean().default(false),
}).superRefine((value, ctx) => {
  if (value.orderType === "DELIVERY") {
    if (!value.addressLine || value.addressLine.trim().length < 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["addressLine"], message: "Delivery address is required." });
    }
    if (!value.city || value.city.trim().length < 2) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["city"], message: "City is required for delivery." });
    }
  }
});

export const reviewSchema = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1, "Pick a rating.").max(5),
  comment: z.string().trim().min(5, "Tell us a little more.").max(600),
});

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name.").max(60),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  subject: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().min(10, "Message must be at least 10 characters.").max(1500),
});

export const productSchema = z.object({
  name: z.string().trim().min(2, "Product name is required.").max(80),
  slug: z.string().trim().max(90).optional().or(z.literal("")),
  description: z.string().trim().min(5, "Add a short description.").max(200),
  longDescription: z.string().trim().max(1200).optional().or(z.literal("")),
  categoryId: z.string().min(1, "Pick a category."),
  price: z.coerce.number().int().min(1, "Price must be greater than zero.").max(100000),
  discountPrice: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  image: z.string().trim().max(500).optional().or(z.literal("")),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isPopular: z.boolean().default(false),
  isVegetarian: z.boolean().default(false),
  spiceLevel: z.enum(["NONE", "MILD", "MEDIUM", "HOT"]).default("NONE"),
  prepTimeMinutes: z.coerce.number().int().min(1).max(180).default(10),
  ingredients: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  calories: z.coerce.number().int().min(0).max(5000).nullable().optional(),
  stock: z.coerce.number().int().min(0).max(100000).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  addonGroupIds: z.array(z.string().min(1)).max(20).default([]),
}).superRefine((value, ctx) => {
  if (value.discountPrice != null && value.discountPrice > 0 && value.discountPrice >= value.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discountPrice"],
      message: "Discount price must be lower than the price.",
    });
  }
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Category name is required.").max(60),
  slug: z.string().trim().max(70).optional().or(z.literal("")),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  image: z.string().trim().max(500).optional().or(z.literal("")),
  icon: z.string().trim().max(40).optional().or(z.literal("")),
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
  isActive: z.boolean().default(true),
});

export const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Code must be at least 3 characters.")
    .max(24)
    .regex(/^[A-Z0-9_-]+$/, "Use letters, numbers, dashes and underscores only."),
  description: z.string().trim().max(200).optional().or(z.literal("")),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.coerce.number().int().min(1, "Discount must be greater than zero.").max(100000),
  minOrderAmount: z.coerce.number().int().min(0).max(1000000).default(0),
  maxDiscount: z.coerce.number().int().min(0).max(1000000).nullable().optional(),
  maxUsage: z.coerce.number().int().min(0).max(1000000).nullable().optional(),
  perUserLimit: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional().or(z.literal("")),
  expiresAt: z.string().datetime().nullable().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (value.discountType === "PERCENTAGE" && value.discountValue > 100) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discountValue"],
      message: "Percentage discount cannot exceed 100.",
    });
  }
});

export const settingsSchema = z.object({
  cafeName: z.string().trim().min(2).max(60),
  tagline: z.string().trim().max(160),
  logoUrl: z.string().trim().max(500).optional().or(z.literal("")),
  phone: z.string().trim().min(5).max(30),
  whatsapp: z.string().trim().regex(/^\d{8,15}$/, "Digits only, including country code (e.g. 923001234567)."),
  email: emailSchema,
  address: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(60),
  mapsQuery: z.string().trim().max(200),
  openingHours: z.string().trim().max(120),
  deliveryFee: z.coerce.number().int().min(0).max(10000),
  freeDeliveryOver: z.coerce.number().int().min(0).max(1000000).nullable().optional(),
  minOrderAmount: z.coerce.number().int().min(0).max(1000000),
  taxPercent: z.coerce.number().min(0).max(100),
  currency: z.string().trim().min(2).max(8),
  currencySymbol: z.string().trim().min(1).max(8),
  instagramUrl: z.string().trim().max(200).optional().or(z.literal("")),
  facebookUrl: z.string().trim().max(200).optional().or(z.literal("")),
  tiktokUrl: z.string().trim().max(200).optional().or(z.literal("")),
  codEnabled: z.boolean(),
  cashAtCounterEnabled: z.boolean(),
  onlinePaymentEnabled: z.boolean(),
  isAcceptingOrders: z.boolean(),
});

export const orderStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
    "CANCELLED",
  ]),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type QuoteInput = z.infer<typeof quoteSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type CouponInput = z.infer<typeof couponSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
