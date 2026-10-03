import { Controller, Delete, Get, HttpCode, Injectable, Module, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser, Roles } from '../common/auth.decorators';
import { PrismaService } from '../prisma/prisma.service';
import { CatalogService } from '../catalog/catalog.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService, private catalog: CatalogService) {}

  async list(userId: bigint) {
    const rows = await this.prisma.wishlist_items.findMany({
      where: { user_id: userId },
      orderBy: { added_at: 'desc' },
      select: { product_id: true },
    });
    const cards = await this.catalog.byIds(rows.map((r) => r.product_id));
    return rows.map((r) => cards.find((c) => c.id === r.product_id)).filter(Boolean);
  }

  async ids(userId: bigint) {
    const rows = await this.prisma.wishlist_items.findMany({ where: { user_id: userId }, select: { product_id: true } });
    return rows.map((r) => r.product_id);
  }

  async add(userId: bigint, productId: bigint) {
    await this.prisma.wishlist_items.upsert({
      where: { user_id_product_id: { user_id: userId, product_id: productId } },
      create: { user_id: userId, product_id: productId },
      update: {},
    });
  }

  async remove(userId: bigint, productId: bigint) {
    await this.prisma.wishlist_items.deleteMany({ where: { user_id: userId, product_id: productId } });
  }
}

@ApiTags('wishlist')
@Roles('customer')
@Controller('wishlist')
export class WishlistController {
  constructor(private wl: WishlistService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.wl.list(u.id);
  }

  @Get('ids')
  ids(@CurrentUser() u: AuthUser) {
    return this.wl.ids(u.id);
  }

  @Post(':productId')
  @HttpCode(204)
  add(@CurrentUser() u: AuthUser, @Param('productId', ParseIntPipe) id: number) {
    return this.wl.add(u.id, BigInt(id));
  }

  @Delete(':productId')
  @HttpCode(204)
  remove(@CurrentUser() u: AuthUser, @Param('productId', ParseIntPipe) id: number) {
    return this.wl.remove(u.id, BigInt(id));
  }
}

@Module({ controllers: [WishlistController], providers: [WishlistService] })
export class WishlistModule {}
