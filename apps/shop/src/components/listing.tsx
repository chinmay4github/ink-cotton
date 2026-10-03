import Link from 'next/link';
import { Suspense } from 'react';
import { deptLabel } from '@/lib/format';
import { serverApi } from '@/lib/server-api';
import type { Category, Facets, NavDept, Paged, ProductCard } from '@/lib/types';
import { ActiveFilters, FilterSidebar, SortSelect } from './filters';
import { ChevronLeft, ChevronRight } from './icons';
import { ProductGrid } from './product-card';
import { Empty } from './ui';

type SP = Record<string, string | string[] | undefined>;
const FILTER_KEYS = ['q', 'colors', 'sizes', 'brands', 'minPrice', 'maxPrice', 'sort', 'page', 'featured'];

export function buildQuery(base: Record<string, string | undefined>, sp: SP, limit = 24) {
  const q = new URLSearchParams();
  Object.entries(base).forEach(([k, v]) => v && q.set(k, v));
  FILTER_KEYS.forEach((k) => {
    const v = sp[k];
    if (typeof v === 'string' && v) q.set(k, v);
  });
  q.set('limit', String(limit));
  return q;
}

function findCategory(nav: NavDept[], slug?: string): { cat: Category; parent?: Category } | null {
  if (!slug) return null;
  for (const d of nav)
    for (const c of d.categories) {
      if (c.slug === slug) return { cat: c };
      const ch = c.children.find((x) => x.slug === slug);
      if (ch) return { cat: ch, parent: c };
    }
  return null;
}

export async function Listing({ department, category, searchParams, title }: { department?: string; category?: string; searchParams: SP; title?: string }) {
  const qs = buildQuery({ department, category }, searchParams);
  const facetQs = new URLSearchParams(qs);
  facetQs.delete('page');
  facetQs.delete('sort');
  facetQs.delete('limit');

  const [data, facets, nav] = await Promise.all([
    serverApi<Paged<ProductCard>>(`/products?${qs}`, { revalidate: 60 }),
    serverApi<Facets>(`/products/facets?${facetQs}`, { revalidate: 60 }),
    serverApi<NavDept[]>('/catalog/navigation', { revalidate: 300 }),
  ]);

  const found = findCategory(nav ?? [], category);
  const dept = (nav ?? []).find((d) => d.department === department);
  const heading = title ?? found?.cat.name ?? (department ? `${deptLabel(department)}’s clothing` : 'All products');
  const subcats = found ? (found.cat.children.length ? found.cat.children : found.parent?.children ?? []) : dept?.categories ?? [];

  const pageHref = (p: number) => {
    const u = new URLSearchParams(qs);
    u.delete('limit');
    ['department', 'category'].forEach((k) => u.delete(k));
    u.set('page', String(p));
    return `?${u}`;
  };

  return (
    <div className="container-page pb-10 pt-8">
      <nav className="text-xs text-ink-mute" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink">Home</Link>
        {department && <> / <Link href={`/shop/${department}`} className="hover:text-ink">{deptLabel(department)}</Link></>}
        {found?.parent && <> / <Link href={`/shop/${department}/${found.parent.slug}`} className="hover:text-ink">{found.parent.name}</Link></>}
        {found && <> / <span className="text-ink">{found.cat.name}</span></>}
      </nav>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          {department && !category ? <h2 className="font-display text-3xl">All styles</h2> : <h1 className="font-display text-4xl sm:text-5xl">{heading}</h1>}
          <p className="mt-2 text-sm text-ink-mute">{data?.total ?? 0} styles</p>
        </div>
      </div>

      {subcats.length > 0 && (
        <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto">
          {subcats.map((c) => (
            <Link key={c.id} href={`/shop/${department ?? c.department}/${c.slug}`} className={`chip shrink-0 px-4 py-2 text-sm ${c.slug === category ? 'border-ink bg-ink text-white' : 'hover:border-ink'}`}>
              {c.name}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 flex gap-10">
        <Suspense>{facets && <FilterSidebar facets={facets} />}</Suspense>
        <div className="min-w-0 flex-1">
          <div className="mb-5 flex items-center justify-end gap-3 lg:-mt-2">
            <Suspense><SortSelect /></Suspense>
          </div>
          <Suspense>{facets && <ActiveFilters facets={facets} />}</Suspense>
          {!data ? (
            <Empty title="We couldn’t load products" body="Please refresh the page in a moment." />
          ) : data.items.length === 0 ? (
            <Empty title="No matches" body="Try removing a filter or searching for something else." action={<Link className="btn-primary" href={department ? `/shop/${department}` : '/'}>Clear filters</Link>} />
          ) : (
            <>
              <ProductGrid items={data.items} />
              {data.totalPages > 1 && (
                <nav className="mt-12 flex items-center justify-center gap-2" aria-label="Pagination">
                  {data.page > 1 && <Link className="btn-outline px-3 py-2" href={pageHref(data.page - 1)} aria-label="Previous page"><ChevronLeft size={16} /></Link>}
                  {Array.from({ length: data.totalPages }, (_, i) => i + 1)
                    .filter((p) => Math.abs(p - data.page) <= 2 || p === 1 || p === data.totalPages)
                    .map((p) => (
                      <Link key={p} href={pageHref(p)} className={`grid h-10 w-10 place-items-center rounded-full text-sm ${p === data.page ? 'bg-ink text-white' : 'hover:bg-paper-warm'}`}>{p}</Link>
                    ))}
                  {data.page < data.totalPages && <Link className="btn-outline px-3 py-2" href={pageHref(data.page + 1)} aria-label="Next page"><ChevronRight size={16} /></Link>}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
