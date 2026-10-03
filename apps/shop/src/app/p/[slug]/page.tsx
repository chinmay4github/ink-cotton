import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProductRail } from '@/components/product-card';
import { ProductView } from '@/components/product-view';
import { Reviews } from '@/components/reviews';
import { deptLabel } from '@/lib/format';
import { serverApi } from '@/lib/server-api';
import type { ProductCard, ProductDetail } from '@/lib/types';

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 60;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await serverApi<ProductDetail>(`/products/${(await params).slug}`);
  if (!p) return { title: 'Product not found' };
  return {
    title: `${p.brand?.name ? p.brand.name + ' ' : ''}${p.name}`,
    description: p.shortDescription ?? p.description ?? undefined,
    openGraph: { images: p.colors[0]?.images[0]?.url ? [p.colors[0].images[0].url] : [] },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [p, similar] = await Promise.all([
    serverApi<ProductDetail>(`/products/${slug}`),
    serverApi<ProductCard[]>(`/products/${slug}/similar`),
  ]);
  if (!p) notFound();

  // Structured data for rich results in search engines.
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    brand: p.brand?.name,
    description: p.description,
    offers: { '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: p.price, highPrice: p.mrp, availability: p.colors.some((c) => c.sizes.some((s) => s.available)) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
    ...(p.ratingCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.ratingCount } } : {}),
  };

  return (
    <div className="container-page pb-10 pt-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <nav className="mb-6 text-xs text-ink-mute" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-ink">Home</Link> / <Link href={`/shop/${p.department}`} className="hover:text-ink">{deptLabel(p.department)}</Link>
        {p.category.parent && <> / <Link href={`/shop/${p.department}/${p.category.parent.slug}`} className="hover:text-ink">{p.category.parent.name}</Link></>}
        {' / '}<Link href={`/shop/${p.department}/${p.category.slug}`} className="hover:text-ink">{p.category.name}</Link>
      </nav>
      <Suspense><ProductView p={p} /></Suspense>
      <Reviews p={p} />
      {!!similar?.length && (
        <section className="mt-20">
          <h2 className="mb-6 font-display text-3xl">You may also like</h2>
          <ProductRail items={similar.slice(0, 8)} />
        </section>
      )}
    </div>
  );
}
