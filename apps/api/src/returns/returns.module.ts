import {
  BadRequestException, Body, Controller, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseIntPipe, Post,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/auth.decorators';
import { n } from '../common/money';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

export const RETURN_WINDOW_DAYS = 15;
export const RETURN_REASONS = ['size_issue', 'defective', 'wrong_item', 'not_as_described', 'changed_mind'] as const;
export const REASON_LABEL: Record<string, string> = {
  size_issue: 'Size or fit issue',
  defective: 'Damaged or defective',
  wrong_item: 'Wrong item received',
  not_as_described: 'Not as described',
  changed_mind: 'Changed my mind',
};

export class ReturnRequestDto {
  @ApiProperty({ enum: RETURN_REASONS }) @IsIn(RETURN_REASONS as unknown as string[]) reason: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) comments?: string;
}

const RETURN_INCLUDE = {
  order_item: {
    include: {
      order: { select: { order_number: true, shipping_address: true, user_id: true, payment_method: true } },
      vendor: { select: { id: true, display_name: true, user_id: true, pickup_address: true } },
    },
  },
  user: { select: { full_name: true, phone: true } },
  pickup_agent: { include: { user: { select: { full_name: true, phone: true } } } },
} as const;

/**
 * Return lifecycle shared by all four apps:
 *   customer requests  -> admin approves/rejects -> rider claims & picks up -> seller receives -> refund issued.
 */
@Injectable()
export class ReturnsService {
  constructor(private prisma: PrismaService, private notify: NotificationsService) {}

  view(r: any) {
    const it = r.order_item;
    const pa = it.vendor.pickup_address;
    return {
      id: r.id,
      status: r.status,
      reason: r.reason,
      reasonLabel: REASON_LABEL[r.reason] ?? r.reason,
      comments: r.comments,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      pickedUpAt: r.picked_up_at,
      refundAmount: r.refund_amount == null ? null : n(r.refund_amount),
      orderNumber: it.order.order_number,
      customer: { name: r.user.full_name, phone: r.user.phone },
      pickupFrom: it.order.shipping_address,
      dropTo: { name: it.vendor.display_name, line1: pa?.line1, city: pa?.city, state: pa?.state, postalCode: pa?.postal_code, phone: pa?.contact_phone },
      seller: it.vendor.display_name,
      rider: r.pickup_agent ? { id: r.pickup_agent.id, name: r.pickup_agent.user.full_name, phone: r.pickup_agent.user.phone } : null,
      item: {
        id: it.id, name: it.product_name, sku: it.sku, color: it.color_name, size: it.size_code, image: it.image_url,
        quantity: it.quantity, total: n(it.line_total),
      },
    };
  }

  async list(where: object) {
    const rows = await this.prisma.return_requests.findMany({ where, include: RETURN_INCLUDE, orderBy: { created_at: 'desc' }, take: 200 });
    return rows.map((r) => this.view(r));
  }

  private async get(id: bigint) {
    const r = await this.prisma.return_requests.findUnique({ where: { id }, include: RETURN_INCLUDE });
    if (!r) throw new NotFoundException('Return not found');
    return r;
  }

  // ---------------------------------------------------------------- customer
  async request(userId: bigint, orderNo: string, itemId: bigint, dto: ReturnRequestDto) {
    const it = await this.prisma.order_items.findFirst({
      where: { id: itemId, order: { order_number: orderNo, user_id: userId } },
      include: { shipment_items: { include: { shipment: { select: { delivered_at: true } } } }, return_requests: true },
    });
    if (!it) throw new NotFoundException('Item not found');
    if (it.status !== 'delivered') throw new BadRequestException('Only delivered items can be returned');
    if (it.return_requests.some((x) => x.status !== 'rejected')) throw new BadRequestException('A return is already open for this item');
    const deliveredAt = it.shipment_items[0]?.shipment.delivered_at;
    if (deliveredAt && Date.now() - deliveredAt.getTime() > RETURN_WINDOW_DAYS * 86400_000) {
      throw new BadRequestException(`Returns are accepted within ${RETURN_WINDOW_DAYS} days of delivery`);
    }
    const r = await this.prisma.$transaction(async (tx) => {
      await tx.order_items.update({ where: { id: it.id }, data: { status: 'return_requested' } });
      return tx.return_requests.create({ data: { order_item_id: it.id, user_id: userId, type: 'return', reason: dto.reason, comments: dto.comments } });
    });
    await this.notify.inApp(userId, 'order', 'Return requested', `We've received your return request for ${it.product_name}. We'll confirm the pickup shortly.`, `/orders/${orderNo}`);
    const admins = await this.prisma.users.findMany({ where: { role: 'admin', status: 'active' }, select: { id: true } });
    for (const a of admins) await this.notify.inApp(a.id, 'system', 'New return request', `${orderNo}: ${it.product_name} (${REASON_LABEL[dto.reason]})`, '/returns');
    return this.view(await this.get(r.id));
  }

  // ---------------------------------------------------------------- admin
  async decide(id: bigint, approve: boolean) {
    const r = await this.get(id);
    if (r.status !== 'requested') throw new BadRequestException(`Return is already ${r.status}`);
    await this.prisma.$transaction(async (tx) => {
      await tx.return_requests.update({ where: { id }, data: { status: approve ? 'approved' : 'rejected', updated_at: new Date() } });
      if (!approve) await tx.order_items.update({ where: { id: r.order_item_id }, data: { status: 'delivered' } });
    });
    const no = r.order_item.order.order_number;
    await this.notify.inApp(
      r.user_id,
      'order',
      approve ? 'Return approved' : 'Return not approved',
      approve
        ? `A delivery partner will pick up ${r.order_item.product_name} soon. Keep it packed with tags on.`
        : `Your return for ${r.order_item.product_name} couldn't be approved. Contact support if you need help.`,
      `/orders/${no}`,
    );
    if (approve) await this.notify.inApp(r.order_item.vendor.user_id, 'vendor', 'Return on its way back', `${no}: ${r.order_item.product_name} will be returned to you.`, '/returns');
    return this.view(await this.get(id));
  }

  // ---------------------------------------------------------------- rider
  async claim(id: bigint, agentId: bigint) {
    const won = await this.prisma.return_requests.updateMany({ where: { id, status: 'approved', pickup_agent_id: null }, data: { pickup_agent_id: agentId, updated_at: new Date() } });
    if (!won.count) throw new BadRequestException('This pickup is no longer available');
    return this.view(await this.get(id));
  }

  async pickedUp(id: bigint, agentId: bigint) {
    const r = await this.get(id);
    if (r.pickup_agent_id !== agentId) throw new ForbiddenException('Not your pickup');
    if (r.status !== 'approved') throw new BadRequestException(`Return is ${r.status}`);
    await this.prisma.return_requests.update({ where: { id }, data: { status: 'picked_up', picked_up_at: new Date(), updated_at: new Date() } });
    await this.notify.inApp(r.user_id, 'order', 'Return picked up', `${r.order_item.product_name} is on its way back to the seller. Your refund is issued once they receive it.`, `/orders/${r.order_item.order.order_number}`);
    return this.view(await this.get(id));
  }

  // ---------------------------------------------------------------- seller
  /** Seller confirms the item is back: restock it and refund the customer. */
  async receive(id: bigint, vendorId: bigint, actorId: bigint) {
    const r = await this.get(id);
    if (r.order_item.vendor_id !== vendorId) throw new ForbiddenException('Not your return');
    if (r.status !== 'picked_up') throw new BadRequestException('The rider has not picked this up yet');
    const it = r.order_item;
    const amount = n(it.line_total);

    await this.prisma.$transaction(async (tx) => {
      const done = await tx.return_requests.updateMany({ where: { id, status: 'picked_up' }, data: { status: 'completed', refund_amount: amount, updated_at: new Date() } });
      if (!done.count) throw new BadRequestException('Return already completed');
      await tx.order_items.update({ where: { id: it.id }, data: { status: 'refunded' } });
      await tx.product_variants.update({ where: { id: it.variant_id }, data: { stock_qty: { increment: it.quantity } } });
      await tx.inventory_movements.create({
        data: { variant_id: it.variant_id, change_qty: it.quantity, reason: 'return', reference_type: 'return_request', reference_id: id, created_by: actorId },
      });
      const pay = await tx.payments.findFirst({ where: { order_id: it.order_id, status: { in: ['success', 'partially_refunded'] } }, orderBy: { created_at: 'desc' } });
      if (pay) {
        await tx.refunds.create({
          data: { payment_id: pay.id, order_item_id: it.id, amount, reason: `Return: ${REASON_LABEL[r.reason] ?? r.reason}`, status: 'processed', processed_at: new Date(), gateway_refund_id: `rfnd_${id}` },
        });
        const refunded = await tx.refunds.aggregate({ where: { payment_id: pay.id, status: 'processed' }, _sum: { amount: true } });
        const all = n(refunded._sum.amount ?? 0) >= n(pay.amount) - 0.01;
        await tx.payments.update({ where: { id: pay.id }, data: { status: all ? 'refunded' : 'partially_refunded' } });
      }
      const open = await tx.order_items.count({ where: { order_id: it.order_id, status: { notIn: ['refunded', 'cancelled'] } } });
      if (!open) await tx.orders.update({ where: { id: it.order_id }, data: { status: 'refunded' } });
    });

    const method = it.order.payment_method === 'cod' ? 'your bank account / UPI' : 'your original payment method';
    await this.notify.inApp(r.user_id, 'payment', 'Refund issued', `₹${amount.toLocaleString('en-IN')} for ${it.product_name} has been refunded to ${method}.`, `/orders/${it.order.order_number}`);
    return this.view(await this.get(id));
  }
}

@ApiTags('returns')
@Controller()
export class ReturnsController {
  constructor(private returns: ReturnsService) {}

  @Get('returns')
  mine(@CurrentUser() u: AuthUser) {
    return this.returns.list({ user_id: u.id });
  }

  @HttpCode(201)
  @Post('orders/:orderNumber/items/:itemId/return')
  request(@CurrentUser() u: AuthUser, @Param('orderNumber') no: string, @Param('itemId', ParseIntPipe) itemId: number, @Body() dto: ReturnRequestDto) {
    return this.returns.request(u.id, no, BigInt(itemId), dto);
  }
}

@Module({ imports: [NotificationsModule], controllers: [ReturnsController], providers: [ReturnsService], exports: [ReturnsService] })
export class ReturnsModule {}
