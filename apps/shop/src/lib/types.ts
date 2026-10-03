export type Department = 'men' | 'women' | 'kids';

export interface Color { id: number; name: string; hex: string; family?: string | null; image?: string | null }

export interface ProductCard {
  id: number;
  slug: string;
  name: string;
  brand: string | null;
  department: Department;
  price: number;
  mrp: number;
  discountPct: number;
  rating: number;
  ratingCount: number;
  image: string | null;
  hoverImage: string | null;
  colors: Color[];
  inStock: boolean;
  isNew: boolean;
}

export interface Paged<T> { items: T[]; page: number; limit: number; total: number; totalPages: number }

export interface Category { id: number; name: string; slug: string; department: Department; image_url?: string | null; children: Category[] }
export interface NavDept { department: Department; label: string; categories: Category[] }

export interface Facets {
  colors: (Color & { count: number })[];
  sizes: { code: string; label: string; group: string }[];
  brands: { id: number; name: string; slug: string; count: number }[];
  price: { min: number; max: number };
}

export interface SizeOption { variantId: number; sku: string; code: string; label: string; price: number; mrp: number; available: number; lowStock: boolean }
export interface ProductDetail {
  id: number;
  slug: string;
  name: string;
  brand: { name: string; slug: string } | null;
  department: Department;
  category: { name: string; slug: string; parent: { name: string; slug: string } | null };
  vendor: { id: number; display_name: string; slug: string; rating_avg: number };
  shortDescription: string | null;
  description: string | null;
  careInstructions: string | null;
  sizeGroup: string;
  specs: { label: string; value: string }[];
  price: number;
  mrp: number;
  discountPct: number;
  taxPct: number;
  rating: number;
  ratingCount: number;
  ratingDistribution: { rating: number; count: number }[];
  fitSummary: Record<string, number>;
  colors: (Color & { images: { url: string; thumb: string; alt: string }[]; sizes: SizeOption[] })[];
}

export interface Review {
  id: number; rating: number; title: string | null; body: string | null; sizeFit: string | null;
  author: string; verified: boolean; purchased: string | null; createdAt: string;
}

export interface CartLine {
  id?: number;
  variantId: number;
  productId: number;
  slug: string;
  name: string;
  brand: string | null;
  sku: string;
  color: { id: number; name: string; hex: string };
  size: string;
  sizeLabel: string;
  image: string | null;
  quantity: number;
  price: number;
  mrp: number;
  lineMrp: number;
  lineTotal: number;
  discount: number;
  available: number;
  issue?: 'unavailable' | 'out_of_stock' | 'insufficient_stock';
}

export interface CartQuote {
  lines: CartLine[];
  itemCount: number;
  mrpTotal: number;
  subtotal: number;
  productDiscount: number;
  couponDiscount: number;
  coupon: { code: string; description: string | null } | null;
  couponError: string | null;
  shipping: number;
  freeShippingThreshold: number;
  amountToFreeShipping: number;
  tax: number;
  total: number;
  hasIssues: boolean;
}

export interface Coupon { code: string; description: string | null; discountType: 'percentage' | 'flat'; discountValue: number; maxDiscount: number | null; minOrderAmount: number }

export interface User { id: number; role: string; full_name: string; email: string | null; phone: string | null; created_at: string }

export interface Address {
  id: number; type: 'home' | 'work' | 'other'; contact_name: string; contact_phone: string; line1: string; line2: string | null;
  landmark: string | null; city: string; state: string; postal_code: string; is_default: boolean;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'partially_shipped' | 'shipped' | 'delivered' | 'cancelled' | 'returned' | 'refunded';
export type ShipmentStatus = 'created' | 'assigned' | 'picked_up' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed_attempt' | 'returned_to_vendor' | 'cancelled';

export interface OrderSummary {
  orderNumber: string; status: OrderStatus; placedAt: string; total: number; paymentMethod: string; itemCount: number;
  items: { product_name: string; image_url: string | null; quantity: number; color_name: string; size_code: string; status: string }[];
  estimatedDelivery: string | null; deliveredAt: string | null;
}

export interface OrderDetail {
  orderNumber: string; status: OrderStatus; placedAt: string; cancelledAt: string | null; cancelReason: string | null;
  paymentMethod: string;
  shippingAddress: { name: string; phone: string; line1: string; line2?: string; landmark?: string; city: string; state: string; postalCode: string };
  coupon: string | null;
  amounts: { subtotal: number; discount: number; shipping: number; tax: number; total: number };
  payment: { status: string; method: string; paidAt: string | null; gateway: string } | null;
  items: { id: number; slug: string; name: string; sku: string; color: string; size: string; image: string | null; quantity: number; unitPrice: number; unitMrp: number; discount: number; total: number; status: string }[];
  shipments: {
    id: number; trackingNumber: string; carrier: string; seller: string; status: ShipmentStatus; estimatedDelivery: string | null;
    deliveredAt: string | null; deliveryOtp: string | null;
    agent: { name: string; phone: string | null; vehicle: string | null } | null;
    itemIds: number[];
    events: { status: ShipmentStatus; description: string | null; location: string | null; at: string }[];
  }[];
  canCancel: boolean;
  canPay: boolean;
}

export interface Notification { id: number; type: string; title: string; body: string; deepLink: string | null; isRead: boolean; createdAt: string }
