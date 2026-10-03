'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ProductGrid } from '@/components/product-card';
import { Empty } from '@/components/ui';
import type { ProductCard } from '@/lib/types';

export default function WishlistPage() {
  const { data, isLoading } = useSWR<ProductCard[]>('/wishlist');
  return (
    <div className="container-page py-10">
      <h1 className="font-display text-4xl">Wishlist {data?.length ? <span className="text-ink-mute">({data.length})</span> : null}</h1>
      <div className="mt-8">
        {isLoading && <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton aspect-[4/5]" />)}</div>}
        {data && !data.length && <Empty title="Nothing saved yet" body="Tap the heart on any product to save it here." action={<Link href="/" className="btn-primary">Discover styles</Link>} />}
        {!!data?.length && <ProductGrid items={data} />}
      </div>
    </div>
  );
}
