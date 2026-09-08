import type {
  AddonGroupType,
  OrderStatus,
  OrderType,
  PaymentMethod,
  PaymentStatus,
  Role,
  SpiceLevel,
} from "@prisma/client";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

export type AddonDTO = {
  id: string;
  name: string;
  price: number;
  isDefault: boolean;
  isAvailable: boolean;
};

export type AddonGroupDTO = {
  id: string;
  name: string;
  slug: string;
  type: AddonGroupType;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  addons: AddonDTO[];
};

export type ProductDTO = {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription: string | null;
  price: number;
  discountPrice: number | null;
  image: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  isPopular: boolean;
  isVegetarian: boolean;
  spiceLevel: SpiceLevel;
  prepTimeMinutes: number;
  ingredients: string[];
  calories: number | null;
  stock: number | null;
  ratingAverage: number;
  ratingCount: number;
  soldCount: number;
  createdAt: string;
  category: { id: string; name: string; slug: string };
  addonGroups?: AddonGroupDTO[];
  comboItems?: { productName: string; quantity: number }[];
};

export type CategoryDTO = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  productCount?: number;
};

/** A line item as held in the client-side cart. */
export type CartLine = {
  /** Stable key: product id + sorted addon ids, so identical configs merge. */
  key: string;
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  unitPrice: number;
  addons: { id: string; name: string; price: number; groupName: string }[];
  quantity: number;
  notes?: string;
};

export type PricedCart = {
  lines: (CartLine & { addonsTotal: number; lineTotal: number })[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  tax: number;
  total: number;
  coupon: { code: string; description: string | null; discount: number } | null;
  couponError: string | null;
  itemCount: number;
  estimatedMinutes: number;
};

export type OrderSummaryDTO = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  total: number;
  itemCount: number;
  createdAt: string;
};

export type ApiError = { error: string; fields?: Record<string, string[]> };
