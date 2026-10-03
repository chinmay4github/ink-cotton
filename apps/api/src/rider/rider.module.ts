import {
  BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, Injectable, Module, NotFoundException, Param,
  ParseIntPipe, Patch, Post, Query, Res,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsEmail, IsIn, IsLatitude, IsLongitude, IsOptional, IsString, Length, Matches, MaxLength, MinLength,
} from 'class-validator';
import * as bcrypt from 'bcryptjs';
import type { Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import type { shipment_status } from '../generated/prisma/enums';
import { AuthModule } from '../auth/auth.module';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth.decorators';
import { n } from '../common/money';
import { setSessionCookie } from '../common/session';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationsService } from '../notifications/notifications.service';
import { OrdersModule } from '../orders/orders.module';
import { FulfilmentService } from '../orders/fulfilment.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReturnsModule, ReturnsService } from '../returns/returns.module';

/** Payout per completed task, in rupees. */
export const RATE = { delivery: 45, returnPickup: 30 };
const VEHICLES = ['bike', 'scooter', 'van', 'cycle', 'truck'];

export class RiderRegisterDto {
  @ApiProperty() @IsString() @Length(2, 120) fullName: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @Matches(/^\+?[0-9]{10,15}$/, { message: 'Enter a valid phone number' }) phone: string;
  @ApiProperty() @IsString() @MinLength(8) @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'Password must contain a letter and a number' }) password: string;
  @ApiProperty({ enum: VEHICLES }) @IsIn(VEHICLES) vehicleType: string;
  @ApiProperty() @IsString() @Length(4, 20) vehicleNumber: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) licenseNumber?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @Matches(/^[1-9][0-9]{5}$/, { each: true, message: 'PIN codes are 6 digits' }) pincodes?: string[];
}

export class RiderUpdateDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isAvailable?: boolean;
  @ApiPropertyOptional({ enum: VEHICLES }) @IsOptional() @IsIn(VEHICLES) vehicleType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(4, 20) vehicleNumber?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @Matches(/^[1-9][0-9]{5}$/, { each: true }) pincodes?: string[];
}

const RIDER_STEPS = ['picked_up', 'in_transit', 'out_for_delivery', 'failed_attempt'] as const;
export class JobStatusDto {
  @ApiProperty({ enum: RIDER_STEPS }) @IsIn(RIDER_STEPS as unknown as string[]) status: (typeof RIDER_STEPS)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) locationName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) note?: string;
}

export class DeliverDto {
  @ApiProperty() @Matches(/^[0-9]{6}$/, { message: 'Enter the 6-digit OTP' }) otp: string;
}

export class LocationDto {
  @ApiProperty() @IsLatitude() lat: number;
  @ApiProperty() @IsLongitude() lng: number;
}

class JobsQuery {
  @ApiPropertyOptional({ enum: ['active', 'done'] }) @IsOptional() @IsIn(['active', 'done']) scope?: 'active' | 'done';
}

const ACTIVE: shipment_status[] = ['assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'failed_attempt'];
const JOB_INCLUDE = {
  order: { select: { order_number: true, payment_method: true, user: { select: { full_name: true, phone: true } } } },
  vendor: { select: { display_name: true, support_phone: true } },
  shipment_items: { include: { order_item: { select: { product_name: true, color_name: true, size_code: true, image_url: true } } } },
  shipment_tracking_events: { orderBy: [{ occurred_at: 'asc' as const }, { id: 'asc' as const }] },
};

@Injectable()
export class RiderService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private fulfilment: FulfilmentService,
    private notify: NotificationsService,
    private returns: ReturnsService,
  ) {}

  async agentOf(userId: bigint, requireApproved = true) {
    const a = await this.prisma.delivery_agents.findUnique({ where: { user_id: userId }, include: { user: { select: { full_name: true, phone: true, email: true } } } });
    if (!a) throw new NotFoundException('No rider profile for this account');
    if (requireApproved && a.approval_status !== 'approved') throw new ForbiddenException(`Your rider account is ${a.approval_status}`);
    return a;
  }

  async register(dto: RiderRegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.users.findFirst({ where: { OR: [{ email }, { phone: dto.phone }] }, select: { id: true } })) {
      throw new ConflictException('An account with this email or phone already exists');
    }
    const user = await this.prisma.users.create({
      data: {
        role: 'delivery_agent', full_name: dto.fullName.trim(), email, phone: dto.phone, password_hash: await bcrypt.hash(dto.password, 12),
        delivery_agent: { create: { vehicle_type: dto.vehicleType, vehicle_number: dto.vehicleNumber.toUpperCase(), license_number: dto.licenseNumber, service_pincodes: dto.pincodes ?? [] } },
      },
    });
    const admins = await this.prisma.users.findMany({ where: { role: 'admin', status: 'active' }, select: { id: true } });
    for (const a of admins) await this.notify.inApp(a.id, 'system', 'New rider application', `${dto.fullName} (${dto.vehicleType}) wants to deliver for Ink & Cotton.`, '/riders');
    return { user: { id: user.id, role: user.role, full_name: user.full_name, email: user.email }, token: this.jwt.sign({ sub: user.id.toString(), role: user.role }) };
  }

  async me(userId: bigint) {
    const a = await this.agentOf(userId, false);
    return {
      id: a.id, name: a.user.full_name, phone: a.user.phone, email: a.user.email, status: a.approval_status, isAvailable: a.is_available,
      vehicleType: a.vehicle_type, vehicleNumber: a.vehicle_number, pincodes: a.service_pincodes, rating: n(a.rating_avg),
      lat: a.current_latitude == null ? null : n(a.current_latitude), lng: a.current_longitude == null ? null : n(a.current_longitude),
    };
  }

  async update(userId: bigint, dto: RiderUpdateDto) {
    const a = await this.agentOf(userId, dto.isAvailable === undefined);
    await this.prisma.delivery_agents.update({
      where: { id: a.id },
      data: { is_available: dto.isAvailable, vehicle_type: dto.vehicleType, vehicle_number: dto.vehicleNumber?.toUpperCase(), service_pincodes: dto.pincodes, updated_at: new Date() },
    });
    return this.me(userId);
  }

  private job(s: any, mine: boolean) {
    const items = s.shipment_items.map((x: any) => ({ name: x.order_item.product_name, color: x.order_item.color_name, size: x.order_item.size_code, image: x.order_item.image_url, quantity: x.quantity }));
    const drop = s.delivery_address as any;
    return {
      id: s.id,
      trackingNumber: s.tracking_number,
      status: s.status,
      orderNumber: s.order.order_number,
      payment: s.order.payment_method === 'cod' ? 'cod' : 'prepaid',
      codAmount: n(s.cod_amount),
      packedAt: s.packed_at,
      assignedAt: s.assigned_at,
      deliveredAt: s.delivered_at,
      attempts: s.attempt_count,
      pickup: s.pickup_address,
      // full drop details only once the job is yours
      drop: mine ? drop : { city: drop?.city, postalCode: drop?.postalCode },
      customer: mine ? { name: s.order.user.full_name, phone: s.order.user.phone } : null,
      seller: s.vendor.display_name,
      items,
      units: items.reduce((t: number, i: any) => t + i.quantity, 0),
      payout: RATE.delivery,
      next: mine ? this.fulfilment.nextStatuses(s.status).filter((x) => x !== 'returned_to_vendor' && x !== 'cancelled') : [],
      events: (s.shipment_tracking_events ?? []).map((e: any) => ({ status: e.status, description: e.description, location: e.location_name, at: e.occurred_at })),
    };
  }

  async available(userId: bigint) {
    await this.agentOf(userId);
    const rows = await this.prisma.shipments.findMany({
      where: { status: 'created', delivery_agent_id: null, packed_at: { not: null } },
      orderBy: { packed_at: 'asc' },
      take: 50,
      include: JOB_INCLUDE,
    });
    return rows.map((s) => this.job(s, false));
  }

  async jobs(userId: bigint, scope: 'active' | 'done' = 'active') {
    const a = await this.agentOf(userId);
    const rows = await this.prisma.shipments.findMany({
      where: { delivery_agent_id: a.id, status: scope === 'active' ? { in: ACTIVE } : { in: ['delivered', 'returned_to_vendor', 'cancelled'] } },
      orderBy: scope === 'active' ? { assigned_at: 'asc' } : { updated_at: 'desc' },
      take: 100,
      include: JOB_INCLUDE,
    });
    return rows.map((s) => this.job(s, true));
  }

  private async mine(userId: bigint, id: bigint) {
    const a = await this.agentOf(userId);
    const s = await this.prisma.shipments.findUnique({ where: { id }, include: JOB_INCLUDE });
    if (!s) throw new NotFoundException('Job not found');
    if (s.delivery_agent_id !== a.id) throw new ForbiddenException('This job is assigned to someone else');
    return { a, s };
  }

  async one(userId: bigint, id: bigint) {
    const { s } = await this.mine(userId, id);
    return this.job(s, true);
  }

  async claim(userId: bigint, id: bigint) {
    const a = await this.agentOf(userId);
    if (!a.is_available) throw new BadRequestException('Go online to accept jobs');
    // conditional update = only one rider can win a job
    const won = await this.prisma.shipments.updateMany({ where: { id, status: 'created', delivery_agent_id: null, packed_at: { not: null } }, data: { delivery_agent_id: a.id } });
    if (!won.count) throw new BadRequestException('Another rider already took this job');
    try {
      await this.fulfilment.applyStatus(id, 'assigned', { deliveryAgentId: a.id, actorId: userId, note: `${a.user.full_name} will pick up your order` });
    } catch (e) {
      await this.prisma.shipments.updateMany({ where: { id, status: 'created' }, data: { delivery_agent_id: null } });
      throw e;
    }
    return this.one(userId, id);
  }

  async step(userId: bigint, id: bigint, dto: JobStatusDto) {
    const { a, s } = await this.mine(userId, id);
    if (dto.status === 'failed_attempt') {
      await this.prisma.shipments.update({ where: { id }, data: { attempt_count: { increment: 1 } } });
    }
    await this.fulfilment.applyStatus(s.id, dto.status, {
      actorId: userId,
      locationName: dto.locationName,
      note: dto.note,
      latitude: a.current_latitude == null ? undefined : n(a.current_latitude),
      longitude: a.current_longitude == null ? undefined : n(a.current_longitude),
    });
    return this.one(userId, id);
  }

  async deliver(userId: bigint, id: bigint, dto: DeliverDto) {
    const { s } = await this.mine(userId, id);
    if (s.status !== 'out_for_delivery') throw new BadRequestException('Mark the package out for delivery first');
    if (!s.delivery_otp || s.delivery_otp !== dto.otp) throw new BadRequestException('Wrong OTP. Ask the customer for the code in their app.');
    await this.fulfilment.applyStatus(s.id, 'delivered', { actorId: userId, otp: dto.otp, locationName: (s.delivery_address as any)?.city });
    return this.one(userId, id);
  }

  async location(userId: bigint, dto: LocationDto) {
    const a = await this.agentOf(userId);
    const active = await this.prisma.shipments.findFirst({ where: { delivery_agent_id: a.id, status: { in: ['picked_up', 'in_transit', 'out_for_delivery'] } }, select: { id: true } });
    await this.prisma.$transaction([
      this.prisma.delivery_agents.update({ where: { id: a.id }, data: { current_latitude: dto.lat, current_longitude: dto.lng, location_updated_at: new Date() } }),
      this.prisma.delivery_agent_locations.create({ data: { delivery_agent_id: a.id, shipment_id: active?.id, latitude: dto.lat, longitude: dto.lng } }),
    ]);
    return { ok: true };
  }

  // ---------------------------------------------------------------- return pickups
  async returnsAvailable(userId: bigint) {
    await this.agentOf(userId);
    return this.returns.list({ status: 'approved', pickup_agent_id: null });
  }
  async returnsMine(userId: bigint) {
    const a = await this.agentOf(userId);
    return this.returns.list({ pickup_agent_id: a.id });
  }
  async claimReturn(userId: bigint, id: bigint) {
    const a = await this.agentOf(userId);
    if (!a.is_available) throw new BadRequestException('Go online to accept jobs');
    return this.returns.claim(id, a.id);
  }
  async pickedUp(userId: bigint, id: bigint) {
    const a = await this.agentOf(userId);
    return this.returns.pickedUp(id, a.id);
  }

  async earnings(userId: bigint) {
    const a = await this.agentOf(userId);
    const since = new Date(Date.now() - 6 * 86400_000);
    since.setUTCHours(0, 0, 0, 0);
    const [delivered, pickups] = await Promise.all([
      this.prisma.shipments.findMany({ where: { delivery_agent_id: a.id, status: 'delivered' }, select: { delivered_at: true, cod_amount: true, order: { select: { payment_method: true } } } }),
      this.prisma.return_requests.findMany({ where: { pickup_agent_id: a.id, status: { in: ['picked_up', 'completed'] } }, select: { picked_up_at: true } }),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const daily = new Map<string, { deliveries: number; pickups: number; amount: number }>();
    for (let d = 0; d < 7; d++) daily.set(new Date(since.getTime() + d * 86400_000).toISOString().slice(0, 10), { deliveries: 0, pickups: 0, amount: 0 });
    for (const s of delivered) {
      const slot = s.delivered_at && daily.get(s.delivered_at.toISOString().slice(0, 10));
      if (slot) { slot.deliveries++; slot.amount += RATE.delivery; }
    }
    for (const r of pickups) {
      const slot = r.picked_up_at && daily.get(r.picked_up_at.toISOString().slice(0, 10));
      if (slot) { slot.pickups++; slot.amount += RATE.returnPickup; }
    }
    const cod = delivered.filter((s) => s.order.payment_method === 'cod');
    return {
      rates: RATE,
      totals: {
        deliveries: delivered.length,
        pickups: pickups.length,
        earned: delivered.length * RATE.delivery + pickups.length * RATE.returnPickup,
        today: daily.get(today)?.amount ?? 0,
        codCollected: cod.reduce((t, s) => t + n(s.cod_amount), 0),
      },
      daily: [...daily.entries()].map(([date, x]) => ({ date, ...x })),
    };
  }
}

@ApiTags('rider')
@Controller('rider')
@Roles('delivery_agent')
export class RiderController {
  constructor(private r: RiderService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RiderRegisterDto, @Res({ passthrough: true }) res: Response) {
    const out = await this.r.register(dto);
    setSessionCookie(res, out.token);
    return out;
  }

  @Get('me') me(@CurrentUser() u: AuthUser) { return this.r.me(u.id); }
  @Patch('me') update(@CurrentUser() u: AuthUser, @Body() dto: RiderUpdateDto) { return this.r.update(u.id, dto); }
  @Get('jobs/available') available(@CurrentUser() u: AuthUser) { return this.r.available(u.id); }
  @Get('jobs') jobs(@CurrentUser() u: AuthUser, @Query() q: JobsQuery) { return this.r.jobs(u.id, q.scope); }
  @Get('jobs/:id') one(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.r.one(u.id, BigInt(id)); }
  @HttpCode(200) @Post('jobs/:id/claim') claim(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.r.claim(u.id, BigInt(id)); }
  @HttpCode(200) @Post('jobs/:id/status') step(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: JobStatusDto) { return this.r.step(u.id, BigInt(id), dto); }
  @HttpCode(200) @Post('jobs/:id/deliver') deliver(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: DeliverDto) { return this.r.deliver(u.id, BigInt(id), dto); }
  @HttpCode(200) @Post('location') location(@CurrentUser() u: AuthUser, @Body() dto: LocationDto) { return this.r.location(u.id, dto); }
  @Get('returns/available') returnsAvailable(@CurrentUser() u: AuthUser) { return this.r.returnsAvailable(u.id); }
  @Get('returns') returnsMine(@CurrentUser() u: AuthUser) { return this.r.returnsMine(u.id); }
  @HttpCode(200) @Post('returns/:id/claim') claimReturn(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.r.claimReturn(u.id, BigInt(id)); }
  @HttpCode(200) @Post('returns/:id/picked-up') pickedUp(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.r.pickedUp(u.id, BigInt(id)); }
  @Get('earnings') earnings(@CurrentUser() u: AuthUser) { return this.r.earnings(u.id); }
}

@Module({ imports: [AuthModule, NotificationsModule, OrdersModule, ReturnsModule], controllers: [RiderController], providers: [RiderService] })
export class RiderModule {}
