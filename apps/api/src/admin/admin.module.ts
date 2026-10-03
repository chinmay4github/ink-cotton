import {
  BadRequestException, Body, ConflictException, Controller, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post, Query,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Length, Matches, Max, MaxLength, Min } from 'class-validator';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { n } from '../common/money';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersModule } from '../orders/orders.module';
import { FulfilmentService } from '../orders/fulfilment.service';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnsModule, ReturnsService } from '../returns/returns.module';

class ListQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) q?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
}
class ReasonDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) reason?: string;
}
class AssignDto {
  @ApiProperty() @IsInt() agentId: number;
}
class CouponDto {
  @ApiProperty() @Matches(/^[A-Z0-9]{4,20}$/, { message: 'Code: 4-20 capital letters or digits' }) code: string;
  @ApiProperty() @IsString() @Length(3, 200) description: string;
  @ApiProperty({ enum: ['percentage', 'flat'] }) @IsIn(['percentage', 'flat']) discountType: 'percentage' | 'flat';
  @ApiProperty() @IsNumber() @Min(1) @Max(100000) discountValue: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) maxDiscount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) minOrderAmount?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(100) perUserLimit?: number;
  @ApiProperty() @IsInt() @Min(1) @Max(365) validDays: number;
}
class CouponPatchDto {
  @ApiProperty() @IsBoolean() isActive: boolean;
}

const PAGE = 25;
const day = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private orders: OrdersService,
    private fulfilment: FulfilmentService,
    private returns: ReturnsService,
    private notify: NotificationsService,
  ) {}

  private audit(adminId: bigint, action: string, entity: string, id: bigint, values?: object) {
    return this.prisma.admin_audit_log.create({ data: { admin_id: adminId, action, entity_type: entity, entity_id: id, new_values: (values ?? {}) as any } });
  }

  // ---------------------------------------------------------------- overview
  async overview() {
    const since = new Date(Date.now() - 13 * 86400_000);
    since.setUTCHours(0, 0, 0, 0);
    const paid = { status: { notIn: ['pending', 'cancelled'] as any } };
    const [gmv, orderCount, customers, sellers, riders, products, ships, returns, recent, items] = await Promise.all([
      this.prisma.orders.aggregate({ where: paid, _sum: { total_amount: true }, _count: true }),
      this.prisma.orders.groupBy({ by: ['status'], _count: true }),
      this.prisma.users.count({ where: { role: 'customer' } }),
      this.prisma.vendors.groupBy({ by: ['status'], _count: true }),
      this.prisma.delivery_agents.groupBy({ by: ['approval_status', 'is_available'], _count: true }),
      this.prisma.products.groupBy({ by: ['status'], _count: true }),
      this.prisma.shipments.groupBy({ by: ['status'], _count: true }),
      this.prisma.return_requests.groupBy({ by: ['status'], _count: true }),
      this.prisma.orders.findMany({ where: { ...paid, placed_at: { gte: since } }, select: { placed_at: true, total_amount: true } }),
      this.prisma.order_items.groupBy({ by: ['product_name'], where: { status: { notIn: ['cancelled', 'pending', 'refunded'] } }, _sum: { quantity: true, line_total: true }, orderBy: { _sum: { line_total: 'desc' } }, take: 5 }),
    ]);
    const count = (rows: any[], key: string, v: string) => rows.filter((r) => r[key] === v).reduce((s, r) => s + r._count, 0);
    const daily = new Map<string, { orders: number; revenue: number }>();
    for (let d = 0; d < 14; d++) daily.set(day(new Date(since.getTime() + d * 86400_000)), { orders: 0, revenue: 0 });
    for (const o of recent) {
      const slot = daily.get(day(o.placed_at));
      if (slot) { slot.orders++; slot.revenue += n(o.total_amount); }
    }
    const unshipped = count(ships, 'status', 'created');
    return {
      kpis: {
        gmv: n(gmv._sum.total_amount),
        orders: gmv._count,
        aov: gmv._count ? n(gmv._sum.total_amount) / gmv._count : 0,
        customers,
        sellersApproved: count(sellers, 'status', 'approved'),
        sellersPending: count(sellers, 'status', 'pending'),
        ridersApproved: count(riders, 'approval_status', 'approved'),
        ridersPending: count(riders, 'approval_status', 'pending'),
        ridersOnline: riders.filter((r) => r.approval_status === 'approved' && r.is_available).reduce((s, r) => s + r._count, 0),
        productsActive: count(products, 'status', 'active'),
        productsPending: count(products, 'status', 'pending_approval'),
        awaitingPickup: unshipped,
        inTransit: ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'failed_attempt'].reduce((s, k) => s + count(ships, 'status', k), 0),
        returnsOpen: count(returns, 'status', 'requested'),
      },
      ordersByStatus: orderCount.map((r) => ({ status: r.status, count: r._count })),
      daily: [...daily.entries()].map(([date, x]) => ({ date, ...x })),
      topProducts: items.map((i) => ({ name: i.product_name, units: i._sum.quantity ?? 0, revenue: n(i._sum.line_total) })),
    };
  }

  // ---------------------------------------------------------------- orders
  async orderList(q: ListQuery) {
    const page = q.page ?? 1;
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.q) where.OR = [{ order_number: { contains: q.q.toUpperCase() } }, { user: { full_name: { contains: q.q, mode: 'insensitive' } } }];
    const [total, rows] = await Promise.all([
      this.prisma.orders.count({ where }),
      this.prisma.orders.findMany({
        where, orderBy: { placed_at: 'desc' }, skip: (page - 1) * PAGE, take: PAGE,
        include: {
          user: { select: { full_name: true } },
          _count: { select: { order_items: true } },
          shipments: { select: { id: true, status: true, packed_at: true, delivery_agent_id: true, tracking_number: true, vendor: { select: { display_name: true } } } },
        },
      }),
    ]);
    return {
      total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)),
      items: rows.map((o) => ({
        orderNumber: o.order_number, status: o.status, placedAt: o.placed_at, customer: o.user.full_name, total: n(o.total_amount),
        paymentMethod: o.payment_method, city: (o.shipping_address as any)?.city, items: o._count.order_items,
        shipments: o.shipments.map((s) => ({ id: s.id, status: s.status, packed: !!s.packed_at, assigned: !!s.delivery_agent_id, seller: s.vendor.display_name, trackingNumber: s.tracking_number })),
      })),
    };
  }

  async orderDetail(no: string) {
    const o = await this.prisma.orders.findUnique({ where: { order_number: no }, select: { user_id: true, user: { select: { full_name: true, email: true, phone: true } } } });
    if (!o) throw new NotFoundException('Order not found');
    const detail = await this.orders.detail(o.user_id, no);
    return { ...detail, customer: { name: o.user.full_name, email: o.user.email, phone: o.user.phone } };
  }

  async cancelOrder(adminId: bigint, no: string, reason?: string) {
    const o = await this.prisma.orders.findUnique({ where: { order_number: no } });
    if (!o) throw new NotFoundException('Order not found');
    const out = await this.orders.cancel(o.user_id, no, reason ?? 'Cancelled by Ink & Cotton support');
    await this.audit(adminId, 'CANCEL_ORDER', 'order', o.id, { reason });
    return out;
  }

  async assign(adminId: bigint, shipmentId: bigint, agentId: bigint) {
    const agent = await this.prisma.delivery_agents.findUnique({ where: { id: agentId }, include: { user: { select: { full_name: true } } } });
    if (!agent || agent.approval_status !== 'approved') throw new BadRequestException('Pick an approved rider');
    const s = await this.prisma.shipments.findUnique({ where: { id: shipmentId } });
    if (!s) throw new NotFoundException('Shipment not found');
    if (s.status !== 'created') throw new BadRequestException('Shipment already has a rider');
    if (!s.packed_at) await this.prisma.shipments.update({ where: { id: s.id }, data: { packed_at: new Date() } });
    const out = await this.fulfilment.applyStatus(shipmentId, 'assigned', { deliveryAgentId: agentId, actorId: adminId, note: `${agent.user.full_name} will pick up your order` });
    await this.audit(adminId, 'ASSIGN_RIDER', 'shipment', shipmentId, { agentId: Number(agentId) });
    await this.notify.inApp(agent.user_id, 'shipment', 'Job assigned to you', `Shipment ${s.tracking_number} was assigned to you by the ops team.`, '/');
    return out;
  }

  // ---------------------------------------------------------------- sellers
  async sellers(q: ListQuery) {
    const rows = await this.prisma.vendors.findMany({
      where: q.status ? { status: q.status as any } : {},
      orderBy: [{ status: 'asc' }, { created_at: 'desc' }],
      include: {
        user: { select: { full_name: true, email: true, phone: true } },
        pickup_address: { select: { city: true, state: true } },
        _count: { select: { products: true } },
      },
    });
    const sales = await this.prisma.order_items.groupBy({ by: ['vendor_id'], where: { status: { notIn: ['cancelled', 'pending', 'refunded'] } }, _sum: { line_total: true } });
    return rows.map((v) => ({
      id: v.id, displayName: v.display_name, businessName: v.business_name, status: v.status, gstin: v.gstin, owner: v.user.full_name, email: v.user.email,
      phone: v.user.phone, city: v.pickup_address?.city, state: v.pickup_address?.state, products: v._count.products, commissionPct: n(v.commission_pct),
      sales: n(sales.find((s) => s.vendor_id === v.id)?._sum.line_total ?? 0), createdAt: v.created_at, rejectionReason: v.rejection_reason,
    }));
  }

  async sellerAction(adminId: bigint, id: bigint, action: 'approve' | 'reject' | 'suspend' | 'reinstate', reason?: string) {
    const v = await this.prisma.vendors.findUnique({ where: { id } });
    if (!v) throw new NotFoundException('Seller not found');
    const status = { approve: 'approved', reject: 'rejected', suspend: 'suspended', reinstate: 'approved' }[action] as any;
    await this.prisma.$transaction(async (tx) => {
      await tx.vendors.update({
        where: { id },
        data: { status, rejection_reason: action === 'reject' || action === 'suspend' ? reason ?? null : null, ...(status === 'approved' ? { approved_by: adminId, approved_at: new Date() } : {}), updated_at: new Date() },
      });
      if (action === 'suspend') await tx.products.updateMany({ where: { vendor_id: id, status: 'active' }, data: { status: 'inactive' } });
    });
    await this.audit(adminId, `${action.toUpperCase()}_VENDOR`, 'vendor', id, { reason });
    const msg = {
      approve: ['You are live on Ink & Cotton', 'Your seller account is approved. Add your first products.'],
      reinstate: ['Seller account reinstated', 'Your account is active again. Switch your products back on from Products.'],
      reject: ['Seller application not approved', reason ?? 'Contact seller support for details.'],
      suspend: ['Seller account suspended', reason ?? 'Your listings are hidden. Contact seller support.'],
    }[action];
    await this.notify.inApp(v.user_id, 'vendor', msg[0], msg[1], '/');
    return { ok: true };
  }

  // ---------------------------------------------------------------- riders
  async riders(q: ListQuery) {
    const rows = await this.prisma.delivery_agents.findMany({
      where: q.status ? { approval_status: q.status as any } : {},
      orderBy: [{ approval_status: 'asc' }, { created_at: 'desc' }],
      include: { user: { select: { full_name: true, email: true, phone: true } } },
    });
    const delivered = await this.prisma.shipments.groupBy({ by: ['delivery_agent_id'], where: { status: 'delivered' }, _count: true });
    const active = await this.prisma.shipments.groupBy({ by: ['delivery_agent_id'], where: { status: { in: ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'failed_attempt'] } }, _count: true });
    return rows.map((a) => ({
      id: a.id, name: a.user.full_name, email: a.user.email, phone: a.user.phone, status: a.approval_status, isAvailable: a.is_available,
      vehicleType: a.vehicle_type, vehicleNumber: a.vehicle_number, pincodes: a.service_pincodes, rating: n(a.rating_avg),
      delivered: delivered.find((d) => d.delivery_agent_id === a.id)?._count ?? 0, activeJobs: active.find((d) => d.delivery_agent_id === a.id)?._count ?? 0,
      createdAt: a.created_at,
    }));
  }

  async riderAction(adminId: bigint, id: bigint, action: 'approve' | 'reject' | 'suspend' | 'reinstate') {
    const a = await this.prisma.delivery_agents.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Rider not found');
    const status = { approve: 'approved', reject: 'rejected', suspend: 'suspended', reinstate: 'approved' }[action] as any;
    await this.prisma.delivery_agents.update({ where: { id }, data: { approval_status: status, is_available: status === 'approved' ? a.is_available : false, updated_at: new Date() } });
    await this.audit(adminId, `${action.toUpperCase()}_RIDER`, 'delivery_agent', id);
    const msg = {
      approve: ['You can start delivering', 'Your rider account is approved. Go online to see jobs near you.'],
      reinstate: ['Rider account reinstated', 'You can go online again.'],
      reject: ['Rider application not approved', 'Contact rider support for details.'],
      suspend: ['Rider account suspended', 'Contact rider support for details.'],
    }[action];
    await this.notify.inApp(a.user_id, 'system', msg[0], msg[1], '/');
    return { ok: true };
  }

  // ---------------------------------------------------------------- products
  async products(q: ListQuery) {
    const page = q.page ?? 1;
    const where: any = {};
    if (q.status) where.status = q.status;
    if (q.q) where.name = { contains: q.q, mode: 'insensitive' };
    const [total, rows] = await Promise.all([
      this.prisma.products.count({ where }),
      this.prisma.products.findMany({
        where, orderBy: [{ created_at: 'desc' }], skip: (page - 1) * PAGE, take: PAGE,
        include: {
          vendor: { select: { display_name: true } },
          category: { select: { name: true } },
          product_images: { orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }], take: 1, select: { url: true } },
          product_variants: { select: { stock_qty: true } },
        },
      }),
    ]);
    return {
      total, page, totalPages: Math.max(1, Math.ceil(total / PAGE)),
      items: rows.map((p) => ({
        id: p.id, name: p.name, slug: p.slug, status: p.status, featured: p.is_featured, seller: p.vendor.display_name, category: p.category.name,
        department: p.department, price: n(p.base_price), mrp: n(p.mrp), image: p.product_images[0]?.url ?? null,
        stock: p.product_variants.reduce((s, x) => s + x.stock_qty, 0), variants: p.product_variants.length, rating: n(p.rating_avg),
        createdAt: p.created_at, rejectionReason: p.rejection_reason,
      })),
    };
  }

  async productAction(adminId: bigint, id: bigint, action: string, reason?: string) {
    const p = await this.prisma.products.findUnique({ where: { id }, include: { vendor: { select: { user_id: true } } } });
    if (!p) throw new NotFoundException('Product not found');
    const data: any = { updated_at: new Date() };
    if (action === 'approve' || action === 'activate') Object.assign(data, { status: 'active', approved_by: adminId, approved_at: new Date(), rejection_reason: null });
    else if (action === 'reject') Object.assign(data, { status: 'rejected', rejection_reason: reason ?? 'Does not meet listing guidelines' });
    else if (action === 'deactivate') data.status = 'inactive';
    else if (action === 'feature') data.is_featured = true;
    else if (action === 'unfeature') data.is_featured = false;
    else throw new BadRequestException('Unknown action');
    await this.prisma.products.update({ where: { id }, data });
    await this.audit(adminId, `${action.toUpperCase()}_PRODUCT`, 'product', id, { reason });
    if (action === 'approve') await this.notify.inApp(p.vendor.user_id, 'vendor', 'Product approved', `"${p.name}" is now live in the shop.`, `/products/${p.id}`);
    if (action === 'reject') await this.notify.inApp(p.vendor.user_id, 'vendor', 'Product not approved', `"${p.name}": ${data.rejection_reason}`, `/products/${p.id}`);
    return { ok: true };
  }

  // ---------------------------------------------------------------- coupons
  async coupons() {
    const rows = await this.prisma.coupons.findMany({ orderBy: { created_at: 'desc' }, include: { vendor: { select: { display_name: true } } } });
    return rows.map((c) => ({
      id: c.id, code: c.code, description: c.description, discountType: c.discount_type, discountValue: n(c.discount_value),
      maxDiscount: c.max_discount == null ? null : n(c.max_discount), minOrderAmount: n(c.min_order_amount), usageLimit: c.usage_limit,
      perUserLimit: c.per_user_limit, used: c.used_count, validFrom: c.valid_from, validTo: c.valid_to, isActive: c.is_active,
      seller: c.vendor?.display_name ?? null, expired: c.valid_to < new Date(),
    }));
  }

  async createCoupon(adminId: bigint, dto: CouponDto) {
    if (dto.discountType === 'percentage' && dto.discountValue > 90) throw new BadRequestException('Percentage discounts go up to 90%');
    if (await this.prisma.coupons.findUnique({ where: { code: dto.code } })) throw new ConflictException('That code already exists');
    const now = new Date();
    const c = await this.prisma.coupons.create({
      data: {
        code: dto.code, description: dto.description, discount_type: dto.discountType, discount_value: dto.discountValue, max_discount: dto.maxDiscount,
        min_order_amount: dto.minOrderAmount ?? 0, usage_limit: dto.usageLimit, per_user_limit: dto.perUserLimit ?? 1,
        valid_from: now, valid_to: new Date(now.getTime() + dto.validDays * 86400_000), created_by: adminId,
      },
    });
    await this.audit(adminId, 'CREATE_COUPON', 'coupon', c.id, dto);
    return { id: c.id };
  }

  async toggleCoupon(adminId: bigint, id: bigint, isActive: boolean) {
    await this.prisma.coupons.update({ where: { id }, data: { is_active: isActive } });
    await this.audit(adminId, isActive ? 'ENABLE_COUPON' : 'DISABLE_COUPON', 'coupon', id);
    return { ok: true };
  }

  // ---------------------------------------------------------------- returns, customers, audit
  returnList(q: ListQuery) {
    return this.returns.list(q.status ? { status: q.status } : {});
  }

  async returnAction(adminId: bigint, id: bigint, approve: boolean) {
    const out = await this.returns.decide(id, approve);
    await this.audit(adminId, approve ? 'APPROVE_RETURN' : 'REJECT_RETURN', 'return_request', id);
    return out;
  }

  async customers(q: ListQuery) {
    const where: any = { role: 'customer' };
    if (q.q) where.OR = [{ full_name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q } }, { phone: { contains: q.q } }];
    const rows = await this.prisma.users.findMany({ where, orderBy: { created_at: 'desc' }, take: 100, select: { id: true, full_name: true, email: true, phone: true, status: true, created_at: true, last_login_at: true } });
    const spend = await this.prisma.orders.groupBy({ by: ['user_id'], where: { user_id: { in: rows.map((r) => r.id) }, status: { notIn: ['pending', 'cancelled'] } }, _sum: { total_amount: true }, _count: true });
    return rows.map((u) => {
      const s = spend.find((x) => x.user_id === u.id);
      return { id: u.id, name: u.full_name, email: u.email, phone: u.phone, status: u.status, joined: u.created_at, lastLogin: u.last_login_at, orders: s?._count ?? 0, spend: n(s?._sum.total_amount ?? 0) };
    });
  }

  async auditLog() {
    const rows = await this.prisma.admin_audit_log.findMany({ orderBy: { created_at: 'desc' }, take: 100, include: { admin: { select: { full_name: true } } } });
    return rows.map((r) => ({ id: r.id, admin: r.admin.full_name, action: r.action, entity: r.entity_type, entityId: r.entity_id, values: r.new_values, at: r.created_at }));
  }
}

const SELLER_ACTIONS = ['approve', 'reject', 'suspend', 'reinstate'] as const;
const PRODUCT_ACTIONS = ['approve', 'reject', 'activate', 'deactivate', 'feature', 'unfeature'];

@ApiTags('admin')
@Controller('admin')
@Roles('admin')
export class AdminController {
  constructor(private a: AdminService) {}

  @Get('overview') overview() { return this.a.overview(); }

  @Get('orders') orders(@Query() q: ListQuery) { return this.a.orderList(q); }
  @Get('orders/:no') order(@Param('no') no: string) { return this.a.orderDetail(no); }
  @HttpCode(200) @Post('orders/:no/cancel') cancel(@CurrentUser() u: AuthUser, @Param('no') no: string, @Body() dto: ReasonDto) { return this.a.cancelOrder(u.id, no, dto.reason); }
  @HttpCode(200) @Post('shipments/:id/assign') assign(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: AssignDto) {
    return this.a.assign(u.id, BigInt(id), BigInt(dto.agentId));
  }

  @Get('sellers') sellers(@Query() q: ListQuery) { return this.a.sellers(q); }
  @HttpCode(200) @Post('sellers/:id/:action') seller(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('action') action: string, @Body() dto: ReasonDto) {
    if (!SELLER_ACTIONS.includes(action as any)) throw new BadRequestException('Unknown action');
    return this.a.sellerAction(u.id, BigInt(id), action as any, dto.reason);
  }

  @Get('riders') riders(@Query() q: ListQuery) { return this.a.riders(q); }
  @HttpCode(200) @Post('riders/:id/:action') rider(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('action') action: string) {
    if (!SELLER_ACTIONS.includes(action as any)) throw new BadRequestException('Unknown action');
    return this.a.riderAction(u.id, BigInt(id), action as any);
  }

  @Get('products') products(@Query() q: ListQuery) { return this.a.products(q); }
  @HttpCode(200) @Post('products/:id/:action') product(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('action') action: string, @Body() dto: ReasonDto) {
    if (!PRODUCT_ACTIONS.includes(action)) throw new BadRequestException('Unknown action');
    return this.a.productAction(u.id, BigInt(id), action, dto.reason);
  }

  @Get('coupons') coupons() { return this.a.coupons(); }
  @Post('coupons') createCoupon(@CurrentUser() u: AuthUser, @Body() dto: CouponDto) { return this.a.createCoupon(u.id, dto); }
  @Patch('coupons/:id') coupon(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: CouponPatchDto) { return this.a.toggleCoupon(u.id, BigInt(id), dto.isActive); }

  @Get('returns') returns(@Query() q: ListQuery) { return this.a.returnList(q); }
  @HttpCode(200) @Post('returns/:id/:action') returnAction(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Param('action') action: string) {
    if (!['approve', 'reject'].includes(action)) throw new BadRequestException('Unknown action');
    return this.a.returnAction(u.id, BigInt(id), action === 'approve');
  }

  @Get('customers') customers(@Query() q: ListQuery) { return this.a.customers(q); }
  @Get('audit') audit() { return this.a.auditLog(); }
}

@Module({ imports: [NotificationsModule, OrdersModule, ReturnsModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
