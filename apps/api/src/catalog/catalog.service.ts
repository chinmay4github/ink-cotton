import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { n } from '../common/money';
import { paged } from '../common/pagination';
import { ProductQuery } from './catalog.dto';

/** Minimal shape needed to render a product card anywhere (listing, wishlist, similar, home rails). */
export const CARD_SELECT = {
  id: true,
  slug: true,
  name: true,
  department: true,
  base_price: true,
  mrp: true,
  rating_avg: true,
  rating_count: true,
  is_featured: true,
  created_at: true,
  brand: { select: { name: true, slug: true } },
  product_variants: {
    where: { is_active: true },
    select: { color_id: true, price: true, mrp: true, stock_qty: true, reserved_qty: true },
  },
  product_images: {
    orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }],
    select: { color_id: true, url: true, is_primary: true },
  },
} satisfies Prisma.productsSelect;

type CardRow = Prisma.productsGetPayload<{ select: typeof CARD_SELECT }>;

@Injectable()
export class CatalogService {
  private colorCache?: { at: number; map: Map<number, { id: number; name: string; hex: string; family: string | null }> };

  constructor(private prisma: PrismaService) {}

  // ---------------------------------------------------------------- lookups
  async colorMap() {
    if (this.colorCache && Date.now() - this.colorCache.at < 5 * 60_000) return this.colorCache.map;
    const rows = await this.prisma.colors.findMany();
    const map = new Map(rows.map((c) => [c.id, { id: c.id, name: c.name, hex: c.hex_code, family: c.color_family }]));
    this.colorCache = { at: Date.now(), map };
    return map;
  }

  async toCards(rows: CardRow[]) {
    const colors = await this.colorMap();
    return rows.map((p) => {
      const variants = p.product_variants;
      const cheapest = variants.reduce<(typeof variants)[number] | null>(
        (best, v) => (!best || n(v.price) < n(best.price) ? v : best),
        null,
      );
      const price = cheapest ? n(cheapest.price) : n(p.base_price);
      const mrp = cheapest ? n(cheapest.mrp) : n(p.mrp);
      const colorIds = [...new Set(variants.map((v) => v.color_id))];
      const imgFor = (cid: number) => p.product_images.find((i) => i.color_id === cid)?.url;
      const primary = p.product_images[0]?.url ?? null;
      const secondary = p.product_images.find((i) => i.url !== primary && i.color_id === p.product_images[0]?.color_id)?.url ?? null;
      return {
        id: p.id,
        slug: p.slug,
        name: p.name,
        brand: p.brand?.name ?? null,
        department: p.department,
        price,
        mrp,
        discountPct: mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0,
        rating: n(p.rating_avg),
        ratingCount: p.rating_count,
        image: primary,
        hoverImage: secondary,
        colors: colorIds.map((id) => ({ ...colors.get(id)!, image: imgFor(id) ?? primary })),
        inStock: variants.some((v) => v.stock_qty - v.reserved_qty > 0),
        isNew: Date.now() - p.created_at.getTime() < 30 * 24 * 3600 * 1000,
      };
    });
  }

  async navigation() {
    const cats = await this.prisma.categories.findMany({
      where: { is_active: true },
      orderBy: [{ department: 'asc' }, { sort_order: 'asc' }],
      select: { id: true, parent_id: true, department: true, name: true, slug: true, image_url: true },
    });
    const depts = ['men', 'women', 'kids'] as const;
    return depts.map((d) => ({
      department: d,
      label: d === 'men' ? 'Men' : d === 'women' ? 'Women' : 'Kids',
      categories: cats
        .filter((c) => c.department === d && !c.parent_id)
        .map((c) => ({ ...c, children: cats.filter((x) => x.parent_id === c.id) })),
    }));
  }

  private async categoryIds(slug: string): Promise<bigint[]> {
    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>`
      WITH RECURSIVE tree AS (
        SELECT id FROM shop.categories WHERE slug = ${slug}
        UNION ALL
        SELECT c.id FROM shop.categories c JOIN tree t ON c.parent_id = t.id
      ) SELECT id FROM tree`;
    if (!rows.length) throw new NotFoundException('Category not found');
    return rows.map((r) => r.id);
  }

  /** Full-text search with prefix matching ("tsh" -> t-shirts). Returns ids ordered by rank. */
  private async searchIds(q: string): Promise<bigint[]> {
    const terms = q
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 6);
    if (!terms.length) return [];
    const tsq = terms.map((t) => `${t.replace(/-/g, '')}:*`).join(' & ');
    const like = `%${q.trim()}%`;
    const squashed = `%${q.toLowerCase().replace(/[^a-z0-9]/g, '')}%`; // "tsh" -> T-Shirt
    const rows = await this.prisma.$queryRaw<{ id: bigint }[]>`
      SELECT p.id
        FROM shop.products p
        LEFT JOIN shop.brands b ON b.id = p.brand_id
        JOIN shop.categories c ON c.id = p.category_id
       WHERE p.status = 'active'
         AND (p.search_vector @@ to_tsquery('english', ${tsq})
              OR c.name ILIKE ${like} OR b.name ILIKE ${like}
              OR regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') LIKE ${squashed})
       ORDER BY ts_rank(p.search_vector, to_tsquery('english', ${tsq})) DESC, p.rating_count DESC
       LIMIT 1000`;
    return rows.map((r) => r.id);
  }

  private async baseWhere(qry: ProductQuery, opts: { skipFacet?: 'colors' | 'sizes' | 'brands' | 'price' } = {}) {
    const where: Prisma.productsWhereInput = { status: 'active' };
    const and: Prisma.productsWhereInput[] = [];
    let searchOrder: bigint[] | undefined;

    if (qry.department) where.department = qry.department;
    if (qry.category) where.category_id = { in: await this.categoryIds(qry.category) };
    if (qry.featured) where.is_featured = true;
    if (qry.q?.trim()) {
      searchOrder = await this.searchIds(qry.q);
      where.id = { in: searchOrder };
    }
    if (qry.brands?.length && opts.skipFacet !== 'brands') where.brand = { slug: { in: qry.brands } };

    const variant: Prisma.product_variantsWhereInput = { is_active: true };
    let hasVariantFilter = false;
    if (qry.colors?.length && opts.skipFacet !== 'colors') {
      variant.color_id = { in: qry.colors };
      hasVariantFilter = true;
    }
    if (qry.sizes?.length && opts.skipFacet !== 'sizes') {
      variant.size = { code: { in: qry.sizes } };
      variant.stock_qty = { gt: 0 };
      hasVariantFilter = true;
    }
    if (opts.skipFacet !== 'price' && (qry.minPrice != null || qry.maxPrice != null)) {
      variant.price = { gte: qry.minPrice ?? undefined, lte: qry.maxPrice ?? undefined };
      hasVariantFilter = true;
    }
    if (hasVariantFilter) and.push({ product_variants: { some: variant } });
    if (and.length) where.AND = and;
    return { where, searchOrder };
  }

  async list(qry: ProductQuery) {
    const { where, searchOrder } = await this.baseWhere(qry);
    const { page, limit } = qry;

    let orderBy: Prisma.productsOrderByWithRelationInput[] = [];
    switch (qry.sort) {
      case 'newest': orderBy = [{ created_at: 'desc' }]; break;
      case 'price_asc': orderBy = [{ base_price: 'asc' }]; break;
      case 'price_desc': orderBy = [{ base_price: 'desc' }]; break;
      case 'rating': orderBy = [{ rating_avg: 'desc' }, { rating_count: 'desc' }]; break;
      case 'discount': orderBy = [{ mrp: 'desc' }]; break;
      default: orderBy = [{ is_featured: 'desc' }, { rating_count: 'desc' }, { created_at: 'desc' }];
    }

    // Relevance for search: page over the ranked id list in memory (ids only, capped at 1000).
    if (searchOrder && qry.sort === 'relevance') {
      const matching = await this.prisma.products.findMany({ where, select: { id: true } });
      const set = new Set(matching.map((m) => m.id));
      const ordered = searchOrder.filter((id) => set.has(id));
      const slice = ordered.slice((page - 1) * limit, page * limit);
      const rows = await this.prisma.products.findMany({ where: { id: { in: slice } }, select: CARD_SELECT });
      rows.sort((a, b) => slice.indexOf(a.id) - slice.indexOf(b.id));
      return paged(await this.toCards(rows), ordered.length, page, limit);
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.products.count({ where }),
      this.prisma.products.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit, select: CARD_SELECT }),
    ]);
    let cards = await this.toCards(rows);
    if (qry.sort === 'discount') cards = cards.sort((a, b) => b.discountPct - a.discountPct);
    return paged(cards, total, page, limit);
  }

  /** Filter facets for the current listing context (each facet ignores its own selection). */
  async facets(qry: ProductQuery) {
    const colorsWhere = (await this.baseWhere(qry, { skipFacet: 'colors' })).where;
    const sizesWhere = (await this.baseWhere(qry, { skipFacet: 'sizes' })).where;
    const brandsWhere = (await this.baseWhere(qry, { skipFacet: 'brands' })).where;
    const priceWhere = (await this.baseWhere(qry, { skipFacet: 'price' })).where;

    const [colorRows, sizeRows, brandRows, price] = await Promise.all([
      this.prisma.product_variants.groupBy({
        by: ['color_id'],
        where: { is_active: true, product: colorsWhere },
        _count: { product_id: true },
      }),
      this.prisma.product_variants.findMany({
        where: { is_active: true, stock_qty: { gt: 0 }, product: sizesWhere },
        distinct: ['size_id'],
        select: { size: { select: { id: true, code: true, label: true, size_group: true, sort_order: true } } },
      }),
      this.prisma.products.groupBy({ by: ['brand_id'], where: { ...brandsWhere, brand_id: { not: null } }, _count: { id: true } }),
      this.prisma.product_variants.aggregate({
        where: { is_active: true, product: priceWhere },
        _min: { price: true },
        _max: { price: true },
      }),
    ]);

    const colorMap = await this.colorMap();
    const brands = await this.prisma.brands.findMany({
      where: { id: { in: brandRows.map((b) => b.brand_id!).filter(Boolean) } },
      select: { id: true, name: true, slug: true },
    });
    const groupOrder = ['adult_alpha', 'adult_numeric', 'kids_age', 'footwear', 'free_size'];
    return {
      colors: colorRows
        .map((c) => ({ ...colorMap.get(c.color_id)!, count: c._count.product_id }))
        .sort((a, b) => b.count - a.count),
      sizes: sizeRows
        .map((s) => s.size)
        .sort((a, b) => groupOrder.indexOf(a.size_group) - groupOrder.indexOf(b.size_group) || a.sort_order - b.sort_order)
        .map(({ code, label, size_group }) => ({ code, label, group: size_group })),
      brands: brands
        .map((b) => ({ ...b, count: brandRows.find((r) => r.brand_id === b.id)?._count.id ?? 0 }))
        .sort((a, b) => b.count - a.count),
      price: { min: n(price._min.price), max: n(price._max.price) },
    };
  }

  async detail(slug: string) {
    const p = await this.prisma.products.findFirst({
      where: { slug, status: 'active' },
      include: {
        brand: { select: { name: true, slug: true } },
        category: { select: { name: true, slug: true, parent: { select: { name: true, slug: true } } } },
        vendor: { select: { id: true, display_name: true, slug: true, rating_avg: true } },
        product_variants: {
          where: { is_active: true },
          include: { size: true },
          orderBy: { size: { sort_order: 'asc' } },
        },
        product_images: { orderBy: [{ is_primary: 'desc' }, { sort_order: 'asc' }] },
      },
    });
    if (!p) throw new NotFoundException('Product not found');

    const colorMap = await this.colorMap();
    const generic = p.product_images.filter((i) => i.color_id == null);
    const colorIds = [...new Set(p.product_variants.map((v) => v.color_id))];

    const colors = colorIds.map((cid) => {
      const c = colorMap.get(cid)!;
      const images = [...p.product_images.filter((i) => i.color_id === cid), ...generic].map((i) => ({
        url: i.url,
        thumb: i.thumbnail_url ?? i.url,
        alt: i.alt_text ?? `${p.name} - ${c.name}`,
      }));
      const sizes = p.product_variants
        .filter((v) => v.color_id === cid)
        .map((v) => {
          const available = Math.max(0, v.stock_qty - v.reserved_qty);
          return {
            variantId: v.id,
            sku: v.sku,
            code: v.size.code,
            label: v.size.label,
            price: n(v.price),
            mrp: n(v.mrp),
            available,
            lowStock: available > 0 && available <= v.low_stock_threshold,
          };
        });
      return { ...c, images, sizes };
    });

    const [dist, fit] = await Promise.all([
      this.prisma.product_reviews.groupBy({
        by: ['rating'],
        where: { product_id: p.id, is_approved: true },
        _count: { rating: true },
      }),
      this.prisma.product_reviews.groupBy({
        by: ['size_fit'],
        where: { product_id: p.id, is_approved: true, size_fit: { not: null } },
        _count: { size_fit: true },
      }),
    ]);

    const specs = [
      ['Material', p.material],
      ['Fit', p.fit],
      ['Pattern', p.pattern],
      ['Sleeve', p.sleeve],
      ['Occasion', p.occasion],
      ...Object.entries((p.attributes as Record<string, string>) ?? {}),
    ].filter(([, v]) => v) as [string, string][];

    const prices = p.product_variants.map((v) => n(v.price));
    const price = prices.length ? Math.min(...prices) : n(p.base_price);
    const mrp = p.product_variants.find((v) => n(v.price) === price)?.mrp ?? p.mrp;

    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      department: p.department,
      category: p.category,
      vendor: p.vendor,
      shortDescription: p.short_description,
      description: p.description,
      careInstructions: p.care_instructions,
      sizeGroup: p.size_group,
      sizeChartUrl: p.size_chart_url,
      specs: specs.map(([label, value]) => ({ label, value })),
      price,
      mrp: n(mrp),
      discountPct: n(mrp) > price ? Math.round(((n(mrp) - price) / n(mrp)) * 100) : 0,
      taxPct: n(p.tax_pct),
      rating: n(p.rating_avg),
      ratingCount: p.rating_count,
      ratingDistribution: [5, 4, 3, 2, 1].map((r) => ({
        rating: r,
        count: dist.find((d) => d.rating === r)?._count.rating ?? 0,
      })),
      fitSummary: Object.fromEntries(fit.map((f) => [f.size_fit, f._count.size_fit])),
      colors,
    };
  }

  async similar(slug: string, limit = 8) {
    const p = await this.prisma.products.findFirst({ where: { slug }, select: { id: true, category_id: true, department: true } });
    if (!p) throw new NotFoundException();
    const rows = await this.prisma.products.findMany({
      where: { status: 'active', id: { not: p.id }, department: p.department, category_id: p.category_id },
      orderBy: [{ rating_count: 'desc' }],
      take: limit,
      select: CARD_SELECT,
    });
    if (rows.length < limit) {
      rows.push(
        ...(await this.prisma.products.findMany({
          where: { status: 'active', id: { notIn: [p.id, ...rows.map((r) => r.id)] }, department: p.department },
          orderBy: [{ rating_count: 'desc' }],
          take: limit - rows.length,
          select: CARD_SELECT,
        })),
      );
    }
    return this.toCards(rows);
  }

  async byIds(ids: bigint[]) {
    const rows = await this.prisma.products.findMany({ where: { id: { in: ids }, status: 'active' }, select: CARD_SELECT });
    return this.toCards(rows);
  }
}
