import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param,
  ParseIntPipe, Patch, Post, Query, Res,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUrl, Length, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import type { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth.decorators';
import { n } from '../common/money';
import { setSessionCookie, slugify } from '../common/session';
import { Events } from '../events/events';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnsModule, ReturnsService } from '../returns/returns.module';
import { AuthModule } from '../auth/auth.module';

export const GARMENT_KINDS = ['tshirt', 'polo', 'shirt', 'jacket', 'hoodie', 'jeans', 'chinos', 'shorts', 'kurta', 'dress', 'top', 'saree', 'frock', 'romper', 'sneaker'];

// ------------------------------------------------------------------ DTOs
export class SellerRegisterDto {
  @ApiProperty() @IsString() @Length(2, 120) fullName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @Matches(/^\+?[0-9]{10,15}$/, { message: 'Enter a valid phone number' }) phone: string;
  @ApiProperty() @IsString() @MinLength(8) @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'Password must contain a letter and a number' }) password: string;
  @ApiProperty() @IsString() @Length(2, 150) businessName: string;
  @ApiProperty() @IsString() @Length(2, 150) displayName: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[0-9A-Z]{15}$/, { message: 'GSTIN is 15 characters' }) gstin?: string;
  @ApiProperty() @IsString() @Length(3, 255) line1: string;
  @ApiProperty() @IsString() @Length(2, 100) city: string;
  @ApiProperty() @IsString() @Length(2, 100) state: string;
  @ApiProperty() @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid 6-digit PIN code' }) postalCode: string;
}

export class CreateProductDto {
  @ApiProperty() @IsString() @Length(3, 200) name: string;
  @ApiProperty({ enum: ['men', 'women', 'kids'] }) @IsIn(['men', 'women', 'kids']) department: 'men' | 'women' | 'kids';
  @ApiProperty() @Type(() => Number) @IsInt() categoryId: number;
  @ApiProperty({ enum: GARMENT_KINDS }) @IsIn(GARMENT_KINDS) kind: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) shortDescription?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) material?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) fit?: string;
  @ApiProperty() @IsNumber() @Min(49) @Max(200000) price: number;
  @ApiProperty() @IsNumber() @Min(49) @Max(200000) mrp: number;
  @ApiProperty({ type: [Number] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsInt({ each: true }) colorIds: number[];
  @ApiProperty({ type: [Number] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(12) @IsInt({ each: true }) sizeIds: number[];
  @ApiProperty() @IsInt() @Min(0) @Max(10000) stockPerVariant: number;
  @ApiPropertyOptional({ description: 'https URL of a model / product photo' }) @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) photoUrl?: string;
}

export class UpdateProductDto {
  @ApiPropertyOptional({ enum: ['active', 'inactive'] }) @IsOptional() @IsIn(['active', 'inactive']) status?: 'active' | 'inactive';
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(3, 200) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) shortDescription?: string;
}

export class UpdateVariantDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(100000) stockQty?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(49) price?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(49) mrp?: number;
}

class OrdersQuery {
  @ApiPropertyOptional({ enum: ['to_pack', 'shipping', 'delivered', 'all'] })
  @IsOptional()
  @IsIn(['to_pack', 'shipping', 'delivered', 'all'])
  tab?: string;
}

// ------------------------------------------------------------------ service
const day = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class SellerService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private events: EventEmitter2,
    private notify: NotificationsService,
    private returns: ReturnsService,
  ) {}

  async vendorOf(userId: bigint, requireApproved = true) {
    const v = await this.prisma.vendors.findUnique({ where: { user_id: userId }, include: { pickup_address: true } });
    if (!v) throw new NotFoundException('No seller profile for this account');
    if (requireApproved && v.status !== 'approved') throw new ForbiddenException(`Your seller account is ${v.status}`);
    return v;
  }

  async register(dto: SellerRegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.users.findFirst({ where: { OR: [{ email }, { phone: dto.phone }] }, select: { id: true } })) {
      throw new ConflictException('An account with this email or phone already exists');
    }
    if (dto.gstin && (await this.prisma.vendors.findUnique({ where: { gstin: dto.gstin } }))) throw new ConflictException('GSTIN already registered');
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.users.create({
        data: { role: 'vendor', full_name: dto.fullName.trim(), email, phone: dto.phone, password_hash: await bcrypt.hash(dto.password, 12) },
      });
      const a = await tx.addresses.create({
        data: { user_id: u.id, type: 'warehouse', contact_name: dto.displayName, contact_phone: dto.phone, line1: dto.line1, city: dto.city, state: dto.state, postal_code: dto.postalCode },
      });
      let slug = slugify(dto.displayName);
      if (await tx.vendors.findUnique({ where: { slug } })) slug = `${slug}-${randomBytes(2).toString('hex')}`;
      await tx.vendors.create({
        data: { user_id: u.id, business_name: dto.businessName, display_name: dto.displayName, slug, gstin: dto.gstin, support_email: email, support_phone: dto.phone, pickup_address_id: a.id },
      });
      return u;
    });
    const admins = await this.prisma.users.findMany({ where: { role: 'admin', status: 'active' }, select: { id: true } });
    for (const a of admins) await this.notify.inApp(a.id, 'vendor', 'New seller application', `${dto.displayName} (${dto.city}) wants to sell on Ink & Cotton.`, '/sellers');
    return { user: { id: user.id, role: user.role, full_name: user.full_name, email: user.email }, token: this.jwt.sign({ sub: user.id.toString(), role: user.role }) };
  }

  async me(userId: bigint) {
    const v = await this.vendorOf(userId, false);
    return {
      id: v.id, status: v.status, businessName: v.business_name, displayName: v.display_name, slug: v.slug, gstin: v.gstin,
      commissionPct: n(v.commission_pct), rating: n(v.rating_avg), rejectionReason: v.rejection_reason, createdAt: v.created_at,
      pickup: v.pickup_address ? { line1: v.pickup_address.line1, city: v.pickup_address.city, state: v.pickup_address.state, postalCode: v.pickup_address.postal_code } : null,
    };
  }

  async overview(userId: bigint) {
    const v = await this.vendorOf(userId);
    const since = new Date(Date.now() - 13 * 86400_000);
    since.setUTCHours(0, 0, 0, 0);
    const [items, toPack, shipping, products, pending, lowStock, returns] = await Promise.all([
      this.prisma.order_items.findMany({
        where: { vendor_id: v.id, status: { notIn: ['cancelled', 'pending'] }, order: { status: { notIn: ['pending', 'cancelled'] } } },
        select: { line_total: true, quantity: true, status: true, product_name: true, order: { select: { placed_at: true } } },
      }),
      this.prisma.shipments.count({ where: { vendor_id: v.id, status: 'created', packed_at: null } }),
      this.prisma.shipments.count({ where: { vendor_id: v.id, status: { in: ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'failed_attempt'] } } }),
      this.prisma.products.count({ where: { vendor_id: v.id, status: 'active' } }),
      this.prisma.products.count({ where: { vendor_id: v.id, status: 'pending_approval' } }),
      this.prisma.product_variants.count({ where: { product: { vendor_id: v.id, status: 'active' }, is_active: true, stock_qty: { lte: 5 } } }),
      this.prisma.return_requests.count({ where: { order_item: { vendor_id: v.id }, status: { in: ['approved', 'picked_up'] } } }),
    ]);
    const live = items.filter((i) => i.status !== 'refunded');
    const revenue = live.reduce((s, i) => s + n(i.line_total), 0);
    const daily = new Map<string, { revenue: number; units: number }>();
    for (let d = 0; d < 14; d++) daily.set(day(new Date(since.getTime() + d * 86400_000)), { revenue: 0, units: 0 });
    const top = new Map<string, { units: number; revenue: number }>();
    for (const i of live) {
      const k = day(i.order.placed_at);
      const slot = daily.get(k);
      if (slot) {
        slot.revenue += n(i.line_total);
        slot.units += i.quantity;
      }
      const t = top.get(i.product_name) ?? { units: 0, revenue: 0 };
      t.units += i.quantity;
      t.revenue += n(i.line_total);
      top.set(i.product_name, t);
    }
    return {
      kpis: {
        revenue,
        unitsSold: live.reduce((s, i) => s + i.quantity, 0),
        netEarnings: revenue * (1 - n(v.commission_pct) / 100),
        toPack, shipping, activeProducts: products, pendingProducts: pending, lowStock, openReturns: returns,
      },
      daily: [...daily.entries()].map(([date, x]) => ({ date, ...x })),
      topProducts: [...top.entries()].sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 5).map(([name, x]) => ({ name, ...x })),
    };
  }

  // ---------------------------------------------------------------- orders
  async orders(userId: bigint, tab = 'to_pack') {
    const v = await this.vendorOf(userId);
    const status: any =
      tab === 'to_pack' ? { status: 'created' }
      : tab === 'shipping' ? { status: { in: ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'failed_attempt'] } }
      : tab === 'delivered' ? { status: 'delivered' }
      : {};
    const rows = await this.prisma.shipments.findMany({
      where: { vendor_id: v.id, ...status },
      orderBy: { created_at: tab === 'to_pack' ? 'asc' : 'desc' },
      take: 100,
      include: {
        order: { select: { order_number: true, placed_at: true, payment_method: true, user: { select: { full_name: true } } } },
        shipment_items: { include: { order_item: true } },
        delivery_agent: { include: { user: { select: { full_name: true, phone: true } } } },
        shipment_tracking_events: { orderBy: { id: 'desc' }, take: 1 },
      },
    });
    return rows.map((s) => ({
      id: s.id,
      trackingNumber: s.tracking_number,
      status: s.status,
      packedAt: s.packed_at,
      createdAt: s.created_at,
      deliveredAt: s.delivered_at,
      orderNumber: s.order.order_number,
      placedAt: s.order.placed_at,
      paymentMethod: s.order.payment_method,
      codAmount: n(s.cod_amount),
      customer: s.order.user.full_name,
      shipTo: s.delivery_address,
      rider: s.delivery_agent ? { name: s.delivery_agent.user.full_name, phone: s.delivery_agent.user.phone } : null,
      lastEvent: s.shipment_tracking_events[0] ? { description: s.shipment_tracking_events[0].description, at: s.shipment_tracking_events[0].occurred_at } : null,
      items: s.shipment_items.map((x) => ({
        name: x.order_item.product_name, sku: x.order_item.sku, color: x.order_item.color_name, size: x.order_item.size_code,
        image: x.order_item.image_url, quantity: x.quantity, total: n(x.order_item.line_total),
      })),
      value: s.shipment_items.reduce((t, x) => t + n(x.order_item.line_total), 0),
    }));
  }

  async pack(userId: bigint, shipmentId: bigint) {
    const v = await this.vendorOf(userId);
    const s = await this.prisma.shipments.findFirst({ where: { id: shipmentId, vendor_id: v.id }, include: { shipment_items: true, order: true } });
    if (!s) throw new NotFoundException('Shipment not found');
    if (s.status !== 'created') throw new BadRequestException('Already handed to a rider');
    if (s.packed_at) return { ok: true };
    await this.prisma.$transaction(async (tx) => {
      await tx.shipments.update({ where: { id: s.id }, data: { packed_at: new Date() } });
      await tx.order_items.updateMany({ where: { id: { in: s.shipment_items.map((i) => i.order_item_id) } }, data: { status: 'packed' } });
      await tx.orders.updateMany({ where: { id: s.order_id, status: 'confirmed' }, data: { status: 'processing' } });
    });
    await this.notify.inApp(s.order.user_id, 'shipment', 'Order packed', `${v.display_name} has packed your order ${s.order.order_number}. A delivery partner will pick it up soon.`, `/orders/${s.order.order_number}`);
    const riders = await this.prisma.delivery_agents.findMany({ where: { approval_status: 'approved', is_available: true }, select: { user_id: true } });
    for (const r of riders) await this.notify.inApp(r.user_id, 'shipment', 'New delivery job', `Pickup from ${v.display_name} for ${s.order.order_number}.`, '/jobs');
    return { ok: true };
  }

  // ---------------------------------------------------------------- catalogue
  async meta() {
    const [categories, colors, sizes] = await Promise.all([
      this.prisma.categories.findMany({ where: { is_active: true, parent_id: { not: null } }, orderBy: [{ department: 'asc' }, { sort_order: 'asc' }], select: { id: true, name: true, department: true, slug: true } }),
      this.prisma.colors.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, hex_code: true } }),
      this.prisma.sizes.findMany({ orderBy: [{ size_group: 'asc' }, { sort_order: 'asc' }], select: { id: true, code: true, label: true, size_group: true } }),
    ]);
    return { categories, colors: colors.map((c) => ({ id: c.id, name: c.name, hex: c.hex_code })), sizes, kinds: GARMENT_KINDS };
  }

  async products(userId: bigint) {
    const v = await this.vendorOf(userId);
    const rows = await this.prisma.products.findMany({
      where: { vendor_id: v.id },
      orderBy: { created_at: 'desc' },
      include: {
        category: { select: { name: true } },
        product_images: { orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }], take: 1, select: { url: true } },
        product_variants: { select: { stock_qty: true, reserved_qty: true, is_active: true } },
      },
    });
    return rows.map((p) => ({
      id: p.id, name: p.name, slug: p.slug, status: p.status, department: p.department, category: p.category.name,
      price: n(p.base_price), mrp: n(p.mrp), image: p.product_images[0]?.url ?? null, rating: n(p.rating_avg), ratingCount: p.rating_count,
      variants: p.product_variants.length,
      stock: p.product_variants.reduce((s, x) => s + x.stock_qty, 0),
      lowStock: p.product_variants.filter((x) => x.is_active && x.stock_qty <= 5).length,
      rejectionReason: p.rejection_reason, createdAt: p.created_at,
    }));
  }

  async product(userId: bigint, id: bigint) {
    const v = await this.vendorOf(userId);
    const p = await this.prisma.products.findFirst({
      where: { id, vendor_id: v.id },
      include: {
        category: { select: { name: true } },
        product_images: { orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }], select: { url: true, color_id: true } },
        product_variants: { orderBy: [{ color_id: 'asc' }, { size: { sort_order: 'asc' } }], include: { color: true, size: true } },
      },
    });
    if (!p) throw new NotFoundException('Product not found');
    return {
      id: p.id, name: p.name, slug: p.slug, status: p.status, department: p.department, category: p.category.name, shortDescription: p.short_description,
      material: p.material, fit: p.fit, price: n(p.base_price), mrp: n(p.mrp), rejectionReason: p.rejection_reason,
      images: p.product_images.map((i) => i.url),
      variants: p.product_variants.map((x) => ({
        id: x.id, sku: x.sku, color: x.color.name, hex: x.color.hex_code, size: x.size.code, price: n(x.price), mrp: n(x.mrp),
        stock: x.stock_qty, reserved: x.reserved_qty, active: x.is_active,
      })),
    };
  }

  async createProduct(userId: bigint, dto: CreateProductDto) {
    const v = await this.vendorOf(userId);
    if (dto.price > dto.mrp) throw new BadRequestException('Selling price cannot be above MRP');
    const cat = await this.prisma.categories.findUnique({ where: { id: BigInt(dto.categoryId) } });
    if (!cat || cat.department !== dto.department) throw new BadRequestException('Pick a category from the chosen department');
    const colors = await this.prisma.colors.findMany({ where: { id: { in: dto.colorIds } } });
    const sizes = await this.prisma.sizes.findMany({ where: { id: { in: dto.sizeIds } } });
    if (colors.length !== new Set(dto.colorIds).size || sizes.length !== new Set(dto.sizeIds).size) throw new BadRequestException('Unknown colour or size');
    const groups = new Set(sizes.map((s) => s.size_group));
    if (groups.size !== 1) throw new BadRequestException('All sizes must come from one size chart');

    const slug = `${slugify(dto.name)}-${randomBytes(3).toString('hex')}`;
    const p = await this.prisma.$transaction(async (tx) => {
      const prod = await tx.products.create({
        data: {
          vendor_id: v.id, category_id: cat.id, department: dto.department, name: dto.name.trim(), slug,
          short_description: dto.shortDescription, description: dto.description, material: dto.material, fit: dto.fit,
          size_group: sizes[0].size_group, base_price: dto.price, mrp: dto.mrp, tax_pct: dto.price > 1000 ? 12 : 5,
          status: 'pending_approval', attributes: { kind: dto.kind, 'Country of Origin': 'India' },
        },
      });
      let sort = 0;
      if (dto.photoUrl) await tx.product_images.create({ data: { product_id: prod.id, url: dto.photoUrl, alt_text: dto.name, sort_order: sort++, is_primary: true } });
      for (const c of colors) {
        const hex = c.hex_code.slice(1);
        for (const [vi, view] of ['front', 'back', 'detail'].entries()) {
          await tx.product_images.create({
            data: { product_id: prod.id, color_id: c.id, url: `/img/${dto.kind}/${hex}/${view}.svg`, alt_text: `${dto.name} in ${c.name}`, sort_order: 10 + sort++, is_primary: vi === 0 && !dto.photoUrl },
          });
        }
        for (const z of sizes) {
          const variant = await tx.product_variants.create({
            data: {
              product_id: prod.id, color_id: c.id, size_id: z.id, price: dto.price, mrp: dto.mrp, stock_qty: dto.stockPerVariant,
              sku: `${v.slug.slice(0, 3).toUpperCase()}-${prod.id}-${hex.slice(0, 3).toUpperCase()}-${z.code}`.replace(/[^A-Z0-9-]/gi, ''),
            },
          });
          if (dto.stockPerVariant > 0) {
            await tx.inventory_movements.create({ data: { variant_id: variant.id, change_qty: dto.stockPerVariant, reason: 'restock', reference_type: 'manual', created_by: userId } });
          }
        }
      }
      return prod;
    });
    const admins = await this.prisma.users.findMany({ where: { role: 'admin', status: 'active' }, select: { id: true } });
    for (const a of admins) await this.notify.inApp(a.id, 'vendor', 'Product awaiting approval', `${v.display_name} listed "${p.name}".`, '/products');
    return this.product(userId, p.id);
  }

  async updateProduct(userId: bigint, id: bigint, dto: UpdateProductDto) {
    const v = await this.vendorOf(userId);
    const p = await this.prisma.products.findFirst({ where: { id, vendor_id: v.id } });
    if (!p) throw new NotFoundException('Product not found');
    if (dto.status && !['active', 'inactive'].includes(p.status)) throw new BadRequestException('Only approved products can be switched on or off');
    await this.prisma.products.update({ where: { id }, data: { status: dto.status, name: dto.name, short_description: dto.shortDescription } });
    return this.product(userId, id);
  }

  async updateVariant(userId: bigint, id: bigint, dto: UpdateVariantDto) {
    const v = await this.vendorOf(userId);
    const x = await this.prisma.product_variants.findFirst({ where: { id, product: { vendor_id: v.id } }, include: { product: { select: { name: true } } } });
    if (!x) throw new NotFoundException('Variant not found');
    const price = dto.price ?? n(x.price);
    const mrp = dto.mrp ?? n(x.mrp);
    if (price > mrp) throw new BadRequestException('Selling price cannot be above MRP');
    if (dto.stockQty !== undefined && dto.stockQty < x.reserved_qty) throw new BadRequestException(`${x.reserved_qty} units are reserved by open orders`);
    await this.prisma.$transaction(async (tx) => {
      await tx.product_variants.update({ where: { id }, data: { stock_qty: dto.stockQty, price: dto.price, mrp: dto.mrp } });
      if (dto.stockQty !== undefined && dto.stockQty !== x.stock_qty) {
        await tx.inventory_movements.create({
          data: { variant_id: id, change_qty: dto.stockQty - x.stock_qty, reason: dto.stockQty > x.stock_qty ? 'restock' : 'adjustment', reference_type: 'manual', created_by: userId },
        });
      }
    });
    if (dto.stockQty !== undefined && dto.stockQty <= x.low_stock_threshold) this.events.emit(Events.StockLow, { sku: x.sku, qty: dto.stockQty, vendorUserId: userId });
    return { ok: true };
  }

  // ---------------------------------------------------------------- returns & money
  async returnsList(userId: bigint) {
    const v = await this.vendorOf(userId);
    return this.returns.list({ order_item: { vendor_id: v.id } });
  }

  async receiveReturn(userId: bigint, id: bigint) {
    const v = await this.vendorOf(userId);
    return this.returns.receive(id, v.id, userId);
  }

  async payouts(userId: bigint) {
    const v = await this.vendorOf(userId);
    const [delivered, refunded, payouts] = await Promise.all([
      this.prisma.order_items.aggregate({ where: { vendor_id: v.id, status: 'delivered' }, _sum: { line_total: true }, _count: true }),
      this.prisma.order_items.aggregate({ where: { vendor_id: v.id, status: 'refunded' }, _sum: { line_total: true }, _count: true }),
      this.prisma.vendor_payouts.findMany({ where: { vendor_id: v.id }, orderBy: { period_end: 'desc' } }),
    ]);
    const gross = n(delivered._sum.line_total);
    const commission = (gross * n(v.commission_pct)) / 100;
    const paid = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + n(p.net_amount), 0);
    return {
      commissionPct: n(v.commission_pct),
      deliveredItems: delivered._count,
      gross, commission, net: gross - commission,
      refunds: { items: refunded._count, amount: n(refunded._sum.line_total) },
      paidOut: paid,
      balance: gross - commission - paid,
      payouts: payouts.map((p) => ({ id: p.id, periodStart: p.period_start, periodEnd: p.period_end, gross: n(p.gross_amount), commission: n(p.commission), net: n(p.net_amount), status: p.status, reference: p.reference_no, paidAt: p.paid_at })),
    };
  }
}

// ------------------------------------------------------------------ controller
@ApiTags('seller')
@Controller('seller')
@Roles('vendor')
export class SellerController {
  constructor(private s: SellerService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: SellerRegisterDto, @Res({ passthrough: true }) res: Response) {
    const out = await this.s.register(dto);
    setSessionCookie(res, out.token);
    return out;
  }

  @Get('me') me(@CurrentUser() u: AuthUser) { return this.s.me(u.id); }
  @Get('overview') overview(@CurrentUser() u: AuthUser) { return this.s.overview(u.id); }
  @Get('meta') meta() { return this.s.meta(); }
  @Get('orders') orders(@CurrentUser() u: AuthUser, @Query() q: OrdersQuery) { return this.s.orders(u.id, q.tab); }
  @HttpCode(200) @Post('shipments/:id/pack') pack(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.pack(u.id, BigInt(id)); }
  @Get('products') products(@CurrentUser() u: AuthUser) { return this.s.products(u.id); }
  @Get('products/:id') product(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.product(u.id, BigInt(id)); }
  @Post('products') create(@CurrentUser() u: AuthUser, @Body() dto: CreateProductDto) { return this.s.createProduct(u.id, dto); }
  @Patch('products/:id') update(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto) { return this.s.updateProduct(u.id, BigInt(id), dto); }
  @Patch('variants/:id') variant(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVariantDto) { return this.s.updateVariant(u.id, BigInt(id), dto); }
  @Get('returns') returns(@CurrentUser() u: AuthUser) { return this.s.returnsList(u.id); }
  @HttpCode(200) @Post('returns/:id/receive') receive(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.s.receiveReturn(u.id, BigInt(id)); }
  @Get('payouts') payouts(@CurrentUser() u: AuthUser) { return this.s.payouts(u.id); }
}

@Module({ imports: [AuthModule, NotificationsModule, ReturnsModule], controllers: [SellerController], providers: [SellerService] })
export class SellerModule {}
