import {
  Body, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { AuthUser, CurrentUser } from '../common/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';

export class AddressDto {
  @ApiProperty() @IsString() @Length(2, 120) contactName: string;
  @ApiProperty() @Matches(/^\+?[0-9]{10,15}$/, { message: 'Enter a valid phone number' }) contactPhone: string;
  @ApiProperty() @IsString() @Length(3, 255) line1: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) line2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) landmark?: string;
  @ApiProperty() @IsString() @Length(2, 100) city: string;
  @ApiProperty() @IsString() @Length(2, 100) state: string;
  @ApiProperty() @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid 6-digit PIN code' }) postalCode: string;
  @ApiPropertyOptional({ enum: ['home', 'work', 'other'] }) @IsOptional() @IsIn(['home', 'work', 'other']) type?: 'home' | 'work' | 'other';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}
export class UpdateAddressDto extends PartialType(AddressDto) {}

const toRow = (d: Partial<AddressDto>) => ({
  contact_name: d.contactName,
  contact_phone: d.contactPhone,
  line1: d.line1,
  line2: d.line2,
  landmark: d.landmark,
  city: d.city,
  state: d.state,
  postal_code: d.postalCode,
  type: d.type,
});

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  list(userId: bigint) {
    return this.prisma.addresses.findMany({
      where: { user_id: userId, type: { not: 'warehouse' } },
      orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
    });
  }

  async get(userId: bigint, id: bigint) {
    const a = await this.prisma.addresses.findFirst({ where: { id, user_id: userId } });
    if (!a) throw new NotFoundException('Address not found');
    return a;
  }

  async create(userId: bigint, dto: AddressDto) {
    const count = await this.prisma.addresses.count({ where: { user_id: userId } });
    const makeDefault = dto.isDefault || count === 0;
    return this.prisma.$transaction(async (tx) => {
      if (makeDefault) await tx.addresses.updateMany({ where: { user_id: userId }, data: { is_default: false } });
      return tx.addresses.create({
        data: { ...toRow(dto), user_id: userId, is_default: makeDefault } as any,
      });
    });
  }

  async update(userId: bigint, id: bigint, dto: UpdateAddressDto) {
    await this.get(userId, id);
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.addresses.updateMany({ where: { user_id: userId }, data: { is_default: false } });
      return tx.addresses.update({
        where: { id },
        data: { ...toRow(dto), ...(dto.isDefault !== undefined ? { is_default: dto.isDefault } : {}) },
      });
    });
  }

  async remove(userId: bigint, id: bigint) {
    const a = await this.get(userId, id);
    await this.prisma.addresses.delete({ where: { id } });
    if (a.is_default) {
      const next = await this.prisma.addresses.findFirst({ where: { user_id: userId }, orderBy: { created_at: 'desc' } });
      if (next) await this.prisma.addresses.update({ where: { id: next.id }, data: { is_default: true } });
    }
  }
}

@ApiTags('addresses')
@Controller('addresses')
export class AddressesController {
  constructor(private svc: AddressesService) {}

  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u.id); }
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: AddressDto) { return this.svc.create(u.id, dto); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAddressDto) {
    return this.svc.update(u.id, BigInt(id), dto);
  }
  @Delete(':id') @HttpCode(204) remove(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.svc.remove(u.id, BigInt(id));
  }
}

@Module({ controllers: [AddressesController], providers: [AddressesService], exports: [AddressesService] })
export class AddressesModule {}
