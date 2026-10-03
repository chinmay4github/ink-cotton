import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '../generated/prisma/client';
import type { payment_method } from '../generated/prisma/enums';
import { PrismaService, Tx } from '../prisma/prisma.service';
import { PricingService } from '../cart/pricing.service';
import { CartService } from '../cart/cart.service';
import { orderNumber } from '../common/codes';
import { n } from '../common/money';
import { paged } from '../common/pagination';
import { Events, OrderEvent } from '../events/events';
import { PaymentGateway } from '../payments/payment-gateway';
import { FulfilmentService } from './fulfilment.service';

export const PENDING_PAYMENT_TTL_MIN = 30;
const CANCELLABLE = ['pending', 'confirmed', 'processing'];

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private log = new Logger(OrdersService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
    private cart: CartService,
    private fulfilment: FulfilmentService,
    private gateway: PaymentGateway,
    private events: EventEmitter2,
  ) {}

  // Release stock held by abandoned online-payment orders. Safe to run on every API instance:
  // each order is cancelled with a conditional update, so only one instance wins.
  onModuleInit() {
    if (process.env.DISABLE_JOBS === 'true') return;
    this.timer = setInterval(() => this.expirePending().catch((e) => this.log.error(e)), 60_000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // =========================================================== checkout
  async checkout(userId: bigint, dto: { addressId: bigint; paymentMethod: payment_method; couponCode?: string; notes?: string }) {
    const address = await this.prisma.addresses.findFirst({ where: { id: dto.addressId, user_id: userId } });
    if (!address) throw new NotFoundException('Address not found');
    const items = await this.cart.items(userId);
    if (!items.length) throw new BadRequestException('Your bag is empty');
    const online = dto.paymentMethod !== 'cod';

    const order = await this.prisma.$transaction(
      async (tx) => {
        // Lock the variant rows so two customers can't buy the last unit at the same time.
        const ids = items.map((i) => i.variantId);
        await tx.$queryRaw`SELECT id FROM shop.product_variants WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`;

        const q = await this.pricing.quote(userId, items, dto.couponCode, tx);
        if (q.hasIssues) {
          throw new ConflictException({
            message: 'Some items in your bag are no longer available in the requested quantity',
            lines: q.lines.filter((l) => l.issue).map((l) => ({ variantId: l.variantId, issue: l.issue, available: l.available })),
          });
        }
        if (dto.couponCode && q.couponError) throw new BadRequestException(q.couponError);
        if (dto.paymentMethod === 'cod' && q.total > 50_000) throw new BadRequestException('Cash on delivery is available for orders up to ₹50,000');

        const created = await tx.orders.create({
          data: {
            order_number: orderNumber(),
            user_id: userId,
            shipping_address: {
              name: address.contact_name,
              phone: address.contact_phone,
              line1: address.line1,
              line2: address.line2,
              landmark: address.landmark,
              city: address.city,
              state: address.state,
              postalCode: address.postal_code,
              country: address.country,
              lat: address.latitude,
              lng: address.longitude,
            },
            coupon_id: q.coupon?.id,
            subtotal: q.subtotal,
            discount_amount: q.couponDiscount,
            shipping_fee: q.shipping,
            tax_amount: q.tax,
            total_amount: q.total,
            status: online ? 'pending' : 'confirmed',
            payment_method: dto.paymentMethod,
            notes: dto.notes,
            order_items: {
              create: q.lines.map((l) => ({
                vendor_id: l.vendorId,
                variant_id: l.variantId,
                product_name: l.name,
                sku: l.sku,
                color_name: l.color.name,
                size_code: l.size,
                image_url: l.image,
                unit_price: l.price,
                unit_mrp: l.mrp,
                quantity: l.quantity,
                discount_amount: l.discount,
                tax_amount: Math.round((l.lineTotal - l.discount) * (1 - 1 / (1 + l.taxPct / 100)) * 100) / 100,
                line_total: l.lineTotal - l.discount,
                status: 'pending',
              })),
            },
          },
        });

        // Online: hold stock until the payment settles. COD: take it now.
        for (const l of q.lines) {
          await tx.product_variants.update({
            where: { id: l.variantId },
            data: online ? { reserved_qty: { increment: l.quantity } } : { stock_qty: { decrement: l.quantity } },
          });
          await tx.inventory_movements.create({
            data: {
              variant_id: l.variantId,
              change_qty: -l.quantity,
              reason: online ? 'reserved' : 'sale',
              reference_type: 'order',
              reference_id: created.id,
              created_by: userId,
            },
          });
        }

        if (q.coupon) await tx.coupons.update({ where: { id: q.coupon.id }, data: { used_count: { increment: 1 } } });

        const gw = online ? await this.gateway.createOrder(q.total, 'INR', created.order_number) : null;
        await tx.payments.create({
          data: {
            order_id: created.id,
            method: dto.paymentMethod,
            gateway: gw?.gateway ?? 'cod',
            gateway_order_id: gw?.gatewayOrderId,
            amount: q.total,
            status: 'initiated',
          },
        });

        if (!online) await this.fulfilment.createShipments(tx, created.id);
        await tx.cart_items.deleteMany({ where: { cart: { user_id: userId } } });
        return { ...created, gateway: gw };
      },
      { isolationLevel: 'ReadCommitted', timeout: 15_000 },
    );

    const evt: OrderEvent = { orderId: order.id, orderNumber: order.order_number, userId, total: n(order.total_amount) };
    this.events.emit(online ? Events.OrderPlaced : Events.OrderConfirmed, evt);
    await this.lowStockCheck(items.map((i) => i.variantId));

    return {
      orderNumber: order.order_number,
      status: order.status,
      total: n(order.total_amount),
      payment: order.gateway
        ? { required: true, gateway: order.gateway.gateway, gatewayOrderId: order.gateway.gatewayOrderId, ...order.gateway.clientParams }
        : { required: false },
    };
  }

  private async lowStockCheck(variantIds: bigint[]) {
    const low = await this.prisma.product_variants.findMany({
      where: { id: { in: variantIds } },
      select: { id: true, sku: true, stock_qty: true, low_stock_threshold: true, product: { select: { vendor: { select: { user_id: true } } } } },
    });
    for (const v of low.filter((x) => x.stock_qty <= x.low_stock_threshold)) {
      this.events.emit(Events.StockLow, { variantId: v.id, sku: v.sku, qty: v.stock_qty, vendorUserId: v.product.vendor.user_id });
    }
  }

  // =========================================================== payments
  /** Settle an online payment (from the client callback or a gateway webhook). Idempotent. */
  async settlePayment(userId: bigint | null, orderNo: string, v: { gatewayPaymentId?: string; signature?: string; simulate?: 'success' | 'failure' }) {
    const order = await this.prisma.orders.findFirst({
      where: { order_number: orderNo, ...(userId ? { user_id: userId } : {}) },
      include: { payments: { orderBy: { created_at: 'desc' }, take: 1 } },
    });
    if (!order) throw new NotFoundException('Order not found');
    const payment = order.payments[0];
    if (!payment || payment.method === 'cod') throw new BadRequestException('No online payment for this order');
    if (payment.status === 'success') return { status: 'paid', orderNumber: orderNo };
    if (order.status !== 'pending') throw new BadRequestException(`Order is ${order.status}`);

    const res = await this.gateway.verify({ gatewayOrderId: payment.gateway_order_id!, ...v });

    await this.prisma.$transaction(async (tx) => {
      // Conditional update = idempotency guard against a webhook and the client callback racing.
      const claimed = await tx.payments.updateMany({
        where: { id: payment.id, status: 'initiated' },
        data: res.ok
          ? { status: 'success', gateway_payment_id: res.paymentId, paid_at: new Date(), raw_response: res.raw as any }
          : { status: 'failed', failure_reason: res.reason, raw_response: res.raw as any },
      });
      if (!claimed.count) return;
      const items = await tx.order_items.findMany({ where: { order_id: order.id } });
      if (res.ok) {
        for (const it of items) {
          await tx.product_variants.update({
            where: { id: it.variant_id },
            data: { reserved_qty: { decrement: it.quantity }, stock_qty: { decrement: it.quantity } },
          });
          await tx.inventory_movements.create({
            data: { variant_id: it.variant_id, change_qty: -it.quantity, reason: 'sale', reference_type: 'order', reference_id: order.id },
          });
        }
        await tx.orders.update({ where: { id: order.id }, data: { status: 'confirmed' } });
        await this.fulfilment.createShipments(tx, order.id);
      } else {
        await this.releaseAndCancel(tx, order.id, 'Payment failed');
      }
    });

    const evt: OrderEvent = { orderId: order.id, orderNumber: orderNo, userId: order.user_id, total: n(order.total_amount) };
    this.events.emit(res.ok ? Events.OrderConfirmed : Events.PaymentFailed, evt);
    return { status: res.ok ? 'paid' : 'failed', orderNumber: orderNo, reason: res.reason };
  }

  /** Cancel a pending (unpaid) order and release its reserved stock. */
  private async releaseAndCancel(tx: Tx, orderId: bigint, reason: string) {
    const items = await tx.order_items.findMany({ where: { order_id: orderId } });
    for (const it of items) {
      await tx.product_variants.update({ where: { id: it.variant_id }, data: { reserved_qty: { decrement: it.quantity } } });
      await tx.inventory_movements.create({
        data: { variant_id: it.variant_id, change_qty: it.quantity, reason: 'released', reference_type: 'order', reference_id: orderId },
      });
    }
    const o = await tx.orders.update({
      where: { id: orderId },
      data: { status: 'cancelled', cancelled_at: new Date(), cancel_reason: reason },
    });
    await tx.order_items.updateMany({ where: { order_id: orderId }, data: { status: 'cancelled' } });
    if (o.coupon_id) await tx.coupons.update({ where: { id: o.coupon_id }, data: { used_count: { decrement: 1 } } });
  }

  async expirePending() {
    const cutoff = new Date(Date.now() - PENDING_PAYMENT_TTL_MIN * 60_000);
    const stale = await this.prisma.orders.findMany({ where: { status: 'pending', placed_at: { lt: cutoff } }, select: { id: true }, take: 100 });
    for (const o of stale) {
      await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ id: bigint }[]>`
          SELECT id FROM shop.orders WHERE id = ${o.id} AND status = 'pending' FOR UPDATE SKIP LOCKED`;
        if (!locked.length) return; // paid meanwhile, or another instance is handling it
        await tx.payments.updateMany({ where: { order_id: o.id, status: 'initiated' }, data: { status: 'failed', failure_reason: 'Payment window expired' } });
        await this.releaseAndCancel(tx, o.id, 'Payment not completed in time');
      });
    }
    if (stale.length) this.log.log(`Expired ${stale.length} unpaid orders`);
  }

  // =========================================================== read
  async list(userId: bigint, page: number, limit: number) {
    const where = { user_id: userId };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.orders.count({ where }),
      this.prisma.orders.findMany({
        where,
        orderBy: { placed_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          order_items: { select: { product_name: true, image_url: true, quantity: true, color_name: true, size_code: true, status: true } },
          shipments: { select: { status: true, estimated_delivery: true, delivered_at: true } },
        },
      }),
    ]);
    return paged(
      rows.map((o) => ({
        orderNumber: o.order_number,
        status: o.status,
        placedAt: o.placed_at,
        total: n(o.total_amount),
        paymentMethod: o.payment_method,
        itemCount: o.order_items.reduce((s, i) => s + i.quantity, 0),
        items: o.order_items.slice(0, 4),
        estimatedDelivery: o.shipments.map((s) => s.estimated_delivery).filter(Boolean).sort().pop() ?? null,
        deliveredAt: o.shipments.map((s) => s.delivered_at).filter(Boolean).sort().pop() ?? null,
      })),
      total,
      page,
      limit,
    );
  }

  async detail(userId: bigint, orderNo: string) {
    const o = await this.prisma.orders.findFirst({
      where: { order_number: orderNo, user_id: userId },
      include: {
        order_items: { include: { variant: { select: { product: { select: { slug: true } } } } } },
        payments: { orderBy: { created_at: 'desc' } },
        coupon: { select: { code: true } },
        order_status_history: { orderBy: { created_at: 'asc' } },
        shipments: {
          orderBy: { id: 'asc' },
          include: {
            vendor: { select: { display_name: true } },
            shipment_items: { select: { order_item_id: true } },
            shipment_tracking_events: { orderBy: [{ occurred_at: 'asc' }, { id: 'asc' }] },
            delivery_agent: { include: { user: { select: { full_name: true, phone: true } } } },
          },
        },
      },
    });
    if (!o) throw new NotFoundException('Order not found');

    const anyPicked = o.shipments.some((s) => !['created', 'assigned', 'cancelled'].includes(s.status));
    return {
      orderNumber: o.order_number,
      status: o.status,
      placedAt: o.placed_at,
      cancelledAt: o.cancelled_at,
      cancelReason: o.cancel_reason,
      paymentMethod: o.payment_method,
      shippingAddress: o.shipping_address,
      coupon: o.coupon?.code ?? null,
      amounts: {
        subtotal: n(o.subtotal),
        discount: n(o.discount_amount),
        shipping: n(o.shipping_fee),
        tax: n(o.tax_amount),
        total: n(o.total_amount),
      },
      payment: o.payments[0]
        ? { status: o.payments[0].status, method: o.payments[0].method, paidAt: o.payments[0].paid_at, gateway: o.payments[0].gateway }
        : null,
      items: o.order_items.map((i) => ({
        id: i.id,
        slug: i.variant.product.slug,
        name: i.product_name,
        sku: i.sku,
        color: i.color_name,
        size: i.size_code,
        image: i.image_url,
        quantity: i.quantity,
        unitPrice: n(i.unit_price),
        unitMrp: n(i.unit_mrp),
        discount: n(i.discount_amount),
        total: n(i.line_total),
        status: i.status,
      })),
      shipments: o.shipments.map((s) => ({
        id: s.id,
        trackingNumber: s.tracking_number,
        carrier: s.carrier,
        seller: s.vendor.display_name,
        status: s.status,
        estimatedDelivery: s.estimated_delivery,
        deliveredAt: s.delivered_at,
        deliveryOtp: s.status === 'out_for_delivery' ? s.delivery_otp : null,
        agent: s.delivery_agent
          ? { name: s.delivery_agent.user.full_name, phone: s.delivery_agent.user.phone, vehicle: s.delivery_agent.vehicle_type,
              lat: s.delivery_agent.current_latitude, lng: s.delivery_agent.current_longitude }
          : null,
        itemIds: s.shipment_items.map((x) => x.order_item_id),
        events: s.shipment_tracking_events.map((e) => ({
          status: e.status, description: e.description, location: e.location_name, at: e.occurred_at,
        })),
      })),
      history: o.order_status_history.map((h) => ({ from: h.from_status, to: h.to_status, at: h.created_at })),
      canCancel: CANCELLABLE.includes(o.status) && !anyPicked,
      canPay: o.status === 'pending' && o.payment_method !== 'cod',
    };
  }

  // =========================================================== cancel
  async cancel(userId: bigint, orderNo: string, reason?: string) {
    const o = await this.prisma.orders.findFirst({ where: { order_number: orderNo, user_id: userId }, include: { shipments: true, payments: true } });
    if (!o) throw new NotFoundException('Order not found');
    if (!CANCELLABLE.includes(o.status) || o.shipments.some((s) => !['created', 'assigned', 'cancelled'].includes(s.status))) {
      throw new BadRequestException('This order can no longer be cancelled');
    }

    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.orders.updateMany({ where: { id: o.id, status: o.status }, data: { status: o.status } });
      if (!locked.count) throw new ConflictException('Order changed, please retry');

      if (o.status === 'pending') {
        await tx.payments.updateMany({ where: { order_id: o.id, status: 'initiated' }, data: { status: 'failed', failure_reason: 'Cancelled by customer' } });
        await this.releaseAndCancel(tx, o.id, reason ?? 'Cancelled by customer');
        return;
      }

      const items = await tx.order_items.findMany({ where: { order_id: o.id } });
      for (const it of items) {
        await tx.product_variants.update({ where: { id: it.variant_id }, data: { stock_qty: { increment: it.quantity } } });
        await tx.inventory_movements.create({
          data: { variant_id: it.variant_id, change_qty: it.quantity, reason: 'return', reference_type: 'order_cancel', reference_id: o.id, created_by: userId },
        });
      }
      for (const s of o.shipments.filter((s) => s.status !== 'cancelled')) {
        await tx.shipment_tracking_events.create({ data: { shipment_id: s.id, status: 'cancelled', description: 'Cancelled by customer', updated_by: userId } });
      }
      await tx.order_items.updateMany({ where: { order_id: o.id }, data: { status: 'cancelled' } });
      await tx.orders.update({ where: { id: o.id }, data: { status: 'cancelled', cancelled_at: new Date(), cancel_reason: reason ?? 'Cancelled by customer' } });
      if (o.coupon_id) await tx.coupons.update({ where: { id: o.coupon_id }, data: { used_count: { decrement: 1 } } });

      const paid = o.payments.find((p) => p.status === 'success' && p.method !== 'cod');
      if (paid) {
        // Refund to source. With a real gateway this is async: create 'pending' and settle on the refund webhook.
        await tx.refunds.create({
          data: { payment_id: paid.id, amount: paid.amount, reason: 'Order cancelled', status: 'processed', processed_at: new Date(), gateway_refund_id: `mock_rfnd_${o.order_number}` },
        });
        await tx.payments.update({ where: { id: paid.id }, data: { status: 'refunded' } });
      } else {
        await tx.payments.updateMany({ where: { order_id: o.id, method: 'cod', status: 'initiated' }, data: { status: 'failed', failure_reason: 'Order cancelled' } });
      }
    });

    this.events.emit(Events.OrderCancelled, { orderId: o.id, orderNumber: orderNo, userId, total: n(o.total_amount) } as OrderEvent);
    return this.detail(userId, orderNo);
  }
}
