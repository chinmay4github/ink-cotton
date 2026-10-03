import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from './pricing.service';

export const MAX_QTY_PER_LINE = 10;

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService, private pricing: PricingService) {}

  async cartId(userId: bigint) {
    const cart = await this.prisma.carts.upsert({
      where: { user_id: userId },
      create: { user_id: userId },
      update: {},
      select: { id: true },
    });
    return cart.id;
  }

  async items(userId: bigint) {
    const cartId = await this.cartId(userId);
    const rows = await this.prisma.cart_items.findMany({ where: { cart_id: cartId }, orderBy: { added_at: 'desc' } });
    return rows.map((r) => ({ cartItemId: r.id, variantId: r.variant_id, quantity: r.quantity }));
  }

  async get(userId: bigint, couponCode?: string) {
    return this.pricing.quote(userId, await this.items(userId), couponCode);
  }

  private async assertStock(variantId: bigint, qty: number) {
    const v = await this.prisma.product_variants.findUnique({
      where: { id: variantId },
      select: { stock_qty: true, reserved_qty: true, is_active: true, product: { select: { status: true } } },
    });
    if (!v || !v.is_active || v.product.status !== 'active') throw new NotFoundException('This item is no longer available');
    const available = v.stock_qty - v.reserved_qty;
    if (available <= 0) throw new BadRequestException('This size is out of stock');
    if (qty > available) throw new BadRequestException(`Only ${available} left in stock`);
  }

  async add(userId: bigint, variantId: bigint, quantity: number) {
    const cartId = await this.cartId(userId);
    const existing = await this.prisma.cart_items.findUnique({
      where: { cart_id_variant_id: { cart_id: cartId, variant_id: variantId } },
    });
    const qty = Math.min(MAX_QTY_PER_LINE, (existing?.quantity ?? 0) + quantity);
    await this.assertStock(variantId, qty);
    await this.prisma.cart_items.upsert({
      where: { cart_id_variant_id: { cart_id: cartId, variant_id: variantId } },
      create: { cart_id: cartId, variant_id: variantId, quantity: qty },
      update: { quantity: qty },
    });
    await this.prisma.carts.update({ where: { id: cartId }, data: { updated_at: new Date() } });
    return this.get(userId);
  }

  async update(userId: bigint, itemId: bigint, quantity: number) {
    const cartId = await this.cartId(userId);
    const item = await this.prisma.cart_items.findFirst({ where: { id: itemId, cart_id: cartId } });
    if (!item) throw new NotFoundException('Cart item not found');
    await this.assertStock(item.variant_id, quantity);
    await this.prisma.cart_items.update({ where: { id: itemId }, data: { quantity } });
    return this.get(userId);
  }

  /** Switch size/colour of a line in place (e.g. "change size" in the bag). */
  async changeVariant(userId: bigint, itemId: bigint, variantId: bigint) {
    const cartId = await this.cartId(userId);
    const item = await this.prisma.cart_items.findFirst({ where: { id: itemId, cart_id: cartId } });
    if (!item) throw new NotFoundException('Cart item not found');
    await this.assertStock(variantId, item.quantity);
    await this.prisma.$transaction([
      this.prisma.cart_items.delete({ where: { id: itemId } }),
      this.prisma.cart_items.upsert({
        where: { cart_id_variant_id: { cart_id: cartId, variant_id: variantId } },
        create: { cart_id: cartId, variant_id: variantId, quantity: item.quantity },
        update: { quantity: { increment: item.quantity } },
      }),
    ]);
    return this.get(userId);
  }

  async remove(userId: bigint, itemId: bigint) {
    const cartId = await this.cartId(userId);
    await this.prisma.cart_items.deleteMany({ where: { id: itemId, cart_id: cartId } });
    return this.get(userId);
  }

  /** Merge a guest (browser-side) bag into the account bag after login. Skips unavailable items. */
  async merge(userId: bigint, items: { variantId: bigint; quantity: number }[]) {
    for (const it of items.slice(0, 50)) {
      try {
        await this.add(userId, it.variantId, it.quantity);
      } catch {
        /* out of stock / removed - ignore silently */
      }
    }
    return this.get(userId);
  }

  async count(userId: bigint) {
    const cartId = await this.cartId(userId);
    const agg = await this.prisma.cart_items.aggregate({ where: { cart_id: cartId }, _sum: { quantity: true } });
    return { count: agg._sum.quantity ?? 0 };
  }
}
