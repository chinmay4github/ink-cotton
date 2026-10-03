import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth.decorators';
import { CartService, MAX_QTY_PER_LINE } from './cart.service';
import { PricingService } from './pricing.service';

class AddItemDto {
  @ApiProperty() @Type(() => Number) @IsInt() variantId: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_QTY_PER_LINE) quantity = 1;
}
class UpdateItemDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(MAX_QTY_PER_LINE) quantity?: number;
  @ApiPropertyOptional({ description: 'Change size/colour' }) @IsOptional() @Type(() => Number) @IsInt() variantId?: number;
}
class MergeDto {
  @ApiProperty({ type: [AddItemDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AddItemDto)
  items: AddItemDto[];
}
class CouponQuery {
  @ApiPropertyOptional() @IsOptional() @IsString() coupon?: string;
}

@ApiTags('cart')
@Roles('customer')
@Controller('cart')
export class CartController {
  constructor(private cart: CartService, private pricing: PricingService) {}

  @Get()
  get(@CurrentUser() u: AuthUser, @Query() q: CouponQuery) {
    return this.cart.get(u.id, q.coupon);
  }

  /** Price a guest (not logged-in) bag held in the browser. */
  @Public()
  @HttpCode(200)
  @Post('quote')
  quote(@Body() dto: MergeDto) {
    return this.pricing.quote(null, dto.items.map((i) => ({ variantId: BigInt(i.variantId), quantity: i.quantity })));
  }

  @Get('count')
  count(@CurrentUser() u: AuthUser) {
    return this.cart.count(u.id);
  }

  @Get('coupons')
  coupons(@CurrentUser() u: AuthUser) {
    return this.pricing.availableCoupons(u.id);
  }

  @Post('items')
  add(@CurrentUser() u: AuthUser, @Body() dto: AddItemDto) {
    return this.cart.add(u.id, BigInt(dto.variantId), dto.quantity);
  }

  @Post('merge')
  merge(@CurrentUser() u: AuthUser, @Body() dto: MergeDto) {
    return this.cart.merge(u.id, dto.items.map((i) => ({ variantId: BigInt(i.variantId), quantity: i.quantity })));
  }

  @Patch('items/:id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateItemDto) {
    if (dto.variantId) return this.cart.changeVariant(u.id, BigInt(id), BigInt(dto.variantId));
    return this.cart.update(u.id, BigInt(id), dto.quantity ?? 1);
  }

  @Delete('items/:id')
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.cart.remove(u.id, BigInt(id));
  }
}
