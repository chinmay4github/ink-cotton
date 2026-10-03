import {
  BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, Post, Query,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuthUser, CurrentUser, Public, Roles } from '../common/auth.decorators';
import { PageQuery, paged } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';

class ReviewDto {
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) title?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) body?: string;
  @ApiPropertyOptional({ enum: ['runs_small', 'true_to_size', 'runs_large'] })
  @IsOptional()
  @IsIn(['runs_small', 'true_to_size', 'runs_large'])
  sizeFit?: 'runs_small' | 'true_to_size' | 'runs_large';
}
class ReviewQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['recent', 'highest', 'lowest'] }) @IsOptional() @IsIn(['recent', 'highest', 'lowest']) sort?: string;
}

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  private async productId(slug: string) {
    const p = await this.prisma.products.findUnique({ where: { slug }, select: { id: true } });
    if (!p) throw new NotFoundException('Product not found');
    return p.id;
  }

  async list(slug: string, q: ReviewQuery) {
    const product_id = await this.productId(slug);
    const where = { product_id, is_approved: true };
    const orderBy =
      q.sort === 'highest' ? [{ rating: 'desc' as const }, { created_at: 'desc' as const }]
      : q.sort === 'lowest' ? [{ rating: 'asc' as const }, { created_at: 'desc' as const }]
      : [{ created_at: 'desc' as const }];
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.product_reviews.count({ where }),
      this.prisma.product_reviews.findMany({
        where, orderBy, skip: (q.page - 1) * q.limit, take: q.limit,
        include: { user: { select: { full_name: true } }, order_item: { select: { size_code: true, color_name: true } } },
      }),
    ]);
    return paged(
      rows.map((r) => ({
        id: r.id, rating: r.rating, title: r.title, body: r.body, sizeFit: r.size_fit, images: r.image_urls,
        author: r.user.full_name.split(' ')[0] + (r.user.full_name.includes(' ') ? ` ${r.user.full_name.split(' ').pop()![0]}.` : ''),
        verified: !!r.order_item_id, purchased: r.order_item ? `${r.order_item.color_name} / ${r.order_item.size_code}` : null,
        createdAt: r.created_at,
      })),
      total, q.page, q.limit,
    );
  }

  /** Whether the current customer can review (bought and received it) and their existing review. */
  async eligibility(userId: bigint, slug: string) {
    const product_id = await this.productId(slug);
    const [item, existing] = await Promise.all([
      this.prisma.order_items.findFirst({
        where: { status: 'delivered', order: { user_id: userId }, variant: { product_id } },
        select: { id: true },
      }),
      this.prisma.product_reviews.findUnique({ where: { product_id_user_id: { product_id, user_id: userId } } }),
    ]);
    return { canReview: !!item, existing };
  }

  async upsert(userId: bigint, slug: string, dto: ReviewDto) {
    const product_id = await this.productId(slug);
    const item = await this.prisma.order_items.findFirst({
      where: { status: 'delivered', order: { user_id: userId }, variant: { product_id } },
      orderBy: { created_at: 'desc' },
      select: { id: true },
    });
    if (!item) throw new BadRequestException('You can review a product after it has been delivered to you');
    const data = { rating: dto.rating, title: dto.title, body: dto.body, size_fit: dto.sizeFit, order_item_id: item.id };
    return this.prisma.product_reviews.upsert({
      where: { product_id_user_id: { product_id, user_id: userId } },
      create: { ...data, product_id, user_id: userId },
      update: data,
    });
  }
}

@ApiTags('reviews')
@Controller('products/:slug/reviews')
export class ReviewsController {
  constructor(private svc: ReviewsService) {}

  @Public() @Get() list(@Param('slug') slug: string, @Query() q: ReviewQuery) {
    return this.svc.list(slug, q);
  }
  @Roles('customer') @Get('eligibility') eligibility(@CurrentUser() u: AuthUser, @Param('slug') slug: string) {
    return this.svc.eligibility(u.id, slug);
  }
  @Roles('customer') @Post() upsert(@CurrentUser() u: AuthUser, @Param('slug') slug: string, @Body() dto: ReviewDto) {
    return this.svc.upsert(u.id, slug, dto);
  }
}

@Module({ controllers: [ReviewsController], providers: [ReviewsService] })
export class ReviewsModule {}
