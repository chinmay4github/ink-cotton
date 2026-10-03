import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/auth.decorators';
import { ProductQuery } from './catalog.dto';
import { CatalogService } from './catalog.service';

// Catalog reads are public and CDN-cacheable: short s-maxage + stale-while-revalidate
// lets a CDN / Next.js absorb read traffic while keeping stock/price fresh within a minute.
const CACHE = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

@ApiTags('catalog')
@Public()
@Controller()
export class CatalogController {
  constructor(private catalog: CatalogService) {}

  @Get('catalog/navigation')
  @Header('Cache-Control', CACHE)
  navigation() {
    return this.catalog.navigation();
  }

  @Get('products')
  @Header('Cache-Control', CACHE)
  list(@Query() q: ProductQuery) {
    return this.catalog.list(q);
  }

  @Get('products/facets')
  @Header('Cache-Control', CACHE)
  facets(@Query() q: ProductQuery) {
    return this.catalog.facets(q);
  }

  @Get('products/:slug')
  @Header('Cache-Control', CACHE)
  detail(@Param('slug') slug: string) {
    return this.catalog.detail(slug);
  }

  @Get('products/:slug/similar')
  @Header('Cache-Control', CACHE)
  similar(@Param('slug') slug: string) {
    return this.catalog.similar(slug);
  }
}
