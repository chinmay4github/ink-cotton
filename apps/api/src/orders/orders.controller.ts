import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { PageQuery } from '../common/pagination';
import { OrdersService } from './orders.service';

class CheckoutDto {
  @ApiProperty() @Type(() => Number) @IsInt() addressId: number;
  @ApiProperty({ enum: ['cod', 'upi', 'card', 'netbanking', 'wallet'] })
  @IsIn(['cod', 'upi', 'card', 'netbanking', 'wallet'])
  paymentMethod: 'cod' | 'upi' | 'card' | 'netbanking' | 'wallet';
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(30) couponCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

class PayDto {
  @ApiPropertyOptional() @IsOptional() @IsString() gatewayPaymentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() signature?: string;
  @ApiPropertyOptional({ enum: ['success', 'failure'], description: 'Mock gateway only' })
  @IsOptional()
  @IsIn(['success', 'failure'])
  simulate?: 'success' | 'failure';
}

class CancelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) reason?: string;
}

@ApiTags('orders')
@Roles('customer')
@Controller('orders')
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  checkout(@CurrentUser() u: AuthUser, @Body() dto: CheckoutDto) {
    return this.orders.checkout(u.id, { ...dto, addressId: BigInt(dto.addressId) });
  }

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: PageQuery) {
    return this.orders.list(u.id, q.page, Math.min(q.limit, 20));
  }

  @Get(':orderNumber')
  detail(@CurrentUser() u: AuthUser, @Param('orderNumber') no: string) {
    return this.orders.detail(u.id, no);
  }

  @HttpCode(200)
  @Post(':orderNumber/pay')
  pay(@CurrentUser() u: AuthUser, @Param('orderNumber') no: string, @Body() dto: PayDto) {
    return this.orders.settlePayment(u.id, no, dto);
  }

  @HttpCode(200)
  @Post(':orderNumber/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('orderNumber') no: string, @Body() dto: CancelDto) {
    return this.orders.cancel(u.id, no, dto.reason);
  }
}
