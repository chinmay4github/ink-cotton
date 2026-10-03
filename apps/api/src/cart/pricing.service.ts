import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { inclusiveTax, n, r2, shippingFor, FREE_SHIPPING_THRESHOLD } from '../common/money';

export interface QuoteInput {
  variantId: bigint;
  quantity: number;
  cartItemId?: bigint;
}

export type LineIssue = 'unavailable' | 'out_of_stock' | 'insufficient_stock';

/**
 * Single source of truth for prices, discounts, shipping and tax.
 * Used by the cart (display) and by checkout (inside the order transaction),
 * so what the customer sees is exactly what they are charged.
 */
@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  async quote(userId: bigint | null, items: QuoteInput[], couponCode?: string | null, db: Tx | PrismaService = this.prisma) {
    const variants = await db.product_variants.findMany({
      where: { id: { in: items.map((i) => i.variantId) } },
      include: {
        size: { select: { code: true, label: true } },
        color: { select: { id: true, name: true, hex_code: true } },
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            vendor_id: true,
            tax_pct: true,
            brand: { select: { name: true } },
            product_images: {
              orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
              select: { url: true, color_id: true },
            },
          },
        },
      },
    });

    const lines = items.map((it) => {
      const v = variants.find((x) => x.id === it.variantId);
      if (!v) return null;
      const available = Math.max(0, v.stock_qty - v.reserved_qty);
      let issue: LineIssue | undefined;
      if (!v.is_active || v.product.status !== 'active') issue = 'unavailable';
      else if (available === 0) issue = 'out_of_stock';
      else if (available < it.quantity) issue = 'insufficient_stock';
      const price = n(v.price);
      const mrp = n(v.mrp);
      const img =
        v.product.product_images.find((i) => i.color_id === v.color_id)?.url ?? v.product.product_images[0]?.url ?? null;
      return {
        id: it.cartItemId,
        variantId: v.id,
        productId: v.product.id,
        vendorId: v.product.vendor_id,
        slug: v.product.slug,
        name: v.product.name,
        brand: v.product.brand?.name ?? null,
        sku: v.sku,
        color: { id: v.color.id, name: v.color.name, hex: v.color.hex_code },
        size: v.size.code,
        sizeLabel: v.size.label,
        image: img,
        quantity: it.quantity,
        price,
        mrp,
        taxPct: n(v.product.tax_pct),
        lineMrp: r2(mrp * it.quantity),
        lineTotal: r2(price * it.quantity),
        available,
        issue,
      };
    }).filter((l): l is NonNullable<typeof l> => !!l);

    const billable = lines.filter((l) => !l.issue);
    const mrpTotal = r2(billable.reduce((s, l) => s + l.lineMrp, 0));
    const subtotal = r2(billable.reduce((s, l) => s + l.lineTotal, 0));

    // ------------------------------------------------------------- coupon
    let coupon: { id: bigint; code: string; description: string | null } | null = null;
    let couponError: string | null = null;
    let discount = 0;
    const lineDiscount = new Map<bigint, number>();

    if (couponCode) {
      try {
        if (!userId) throw new BadRequestException('Log in to apply coupons');
        const c = await this.validateCoupon(userId, couponCode, db);
        const eligible = c.vendor_id ? billable.filter((l) => l.vendorId === c.vendor_id) : billable;
        const base = r2(eligible.reduce((s, l) => s + l.lineTotal, 0));
        if (base < n(c.min_order_amount)) {
          throw new BadRequestException(`Add items worth ₹${r2(n(c.min_order_amount) - base)} more to use ${c.code}`);
        }
        discount = c.discount_type === 'percentage' ? (base * n(c.discount_value)) / 100 : n(c.discount_value);
        if (c.max_discount != null) discount = Math.min(discount, n(c.max_discount));
        discount = r2(Math.min(discount, base));
        // Pro-rate the discount across eligible lines (needed for per-item refunds / vendor payouts).
        let left = discount;
        eligible.forEach((l, idx) => {
          const share = idx === eligible.length - 1 ? left : r2((discount * l.lineTotal) / base);
          lineDiscount.set(l.variantId, share);
          left = r2(left - share);
        });
        coupon = { id: c.id, code: c.code, description: c.description };
      } catch (e: any) {
        couponError = e?.message ?? 'Invalid coupon';
      }
    }

    const afterDiscount = r2(subtotal - discount);
    const shipping = shippingFor(afterDiscount);
    const tax = r2(
      billable.reduce((s, l) => s + inclusiveTax(l.lineTotal - (lineDiscount.get(l.variantId) ?? 0), l.taxPct), 0),
    );

    return {
      lines: lines.map((l) => ({ ...l, discount: lineDiscount.get(l.variantId) ?? 0 })),
      itemCount: lines.reduce((s, l) => s + l.quantity, 0),
      mrpTotal,
      subtotal,
      productDiscount: r2(mrpTotal - subtotal),
      couponDiscount: discount,
      coupon,
      couponError,
      shipping,
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      amountToFreeShipping: shipping > 0 ? r2(FREE_SHIPPING_THRESHOLD - afterDiscount) : 0,
      tax, // included in prices (GST-inclusive)
      total: r2(afterDiscount + shipping),
      hasIssues: lines.some((l) => l.issue),
    };
  }

  async validateCoupon(userId: bigint, code: string, db: Tx | PrismaService = this.prisma) {
    const c = await db.coupons.findUnique({ where: { code: code.trim().toUpperCase() } });
    const now = new Date();
    if (!c || !c.is_active || c.valid_from > now || c.valid_to < now) throw new BadRequestException('This coupon is not valid');
    if (c.usage_limit != null && c.used_count >= c.usage_limit) throw new BadRequestException('This coupon has been fully redeemed');
    const used = await db.orders.count({
      where: { user_id: userId, coupon_id: c.id, status: { notIn: ['cancelled'] } },
    });
    if (used >= c.per_user_limit) throw new BadRequestException('You have already used this coupon');
    return c;
  }

  async availableCoupons(userId: bigint) {
    const now = new Date();
    const coupons = await this.prisma.coupons.findMany({
      where: { is_active: true, valid_from: { lte: now }, valid_to: { gte: now } },
      orderBy: { discount_value: 'desc' },
    });
    const used = await this.prisma.orders.groupBy({
      by: ['coupon_id'],
      where: { user_id: userId, coupon_id: { in: coupons.map((c) => c.id) }, status: { not: 'cancelled' } },
      _count: { id: true },
    });
    return coupons
      .filter((c) => (c.usage_limit == null || c.used_count < c.usage_limit) &&
        (used.find((u) => u.coupon_id === c.id)?._count.id ?? 0) < c.per_user_limit)
      .map((c) => ({
        code: c.code,
        description: c.description,
        discountType: c.discount_type,
        discountValue: n(c.discount_value),
        maxDiscount: c.max_discount == null ? null : n(c.max_discount),
        minOrderAmount: n(c.min_order_amount),
        validTo: c.valid_to,
      }));
  }
}
