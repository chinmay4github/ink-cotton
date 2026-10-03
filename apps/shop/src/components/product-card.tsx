'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useState } from 'react';
import type { ProductCard as Card } from '@/lib/types';
import { HeartIcon } from './icons';
import { useWishlist } from './providers';
import { Price, RatingPill } from './ui';

export function ProductCard({ p, priority }: { p: Card; priority?: boolean }) {
  const wl = useWishlist();
  const [img, setImg] = useState<string | null>(null);
  const [hover, setHover] = useState(false);
  const saved = wl.has(p.id);
  const shown = img ?? (hover && p.hoverImage ? p.hoverImage : p.image);

  return (
    <article className="group relative" onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setImg(null); }}>
      <Link href={`/p/${p.slug}`} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-paper-warm">
          {shown && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt={p.name} loading={priority ? 'eager' : 'lazy'} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
          )}
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {p.isNew && <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span>}
            {!p.inStock && <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-soft">Sold out</span>}
          </div>
          <div className="absolute bottom-3 left-3">
            <RatingPill value={p.rating} count={p.ratingCount} />
          </div>
        </div>
      </Link>
      <button
        onClick={() => wl.toggle(p.id)}
        className={clsx('absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 shadow-sm transition hover:scale-105', saved ? 'text-clay' : 'text-ink-soft')}
        aria-label={saved ? 'Remove from wishlist' : 'Add to wishlist'}
      >
        <HeartIcon size={18} filled={saved} />
      </button>
      <div className="mt-3 space-y-1 px-0.5">
        {p.brand && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">{p.brand}</p>}
        <Link href={`/p/${p.slug}`} className="line-clamp-1 text-sm text-ink hover:underline">{p.name}</Link>
        <Price price={p.price} mrp={p.mrp} size="sm" />
        {p.colors.length > 1 && (
          <div className="flex items-center gap-1.5 pt-1">
            {p.colors.slice(0, 5).map((c) => (
              <button
                key={c.id}
                title={c.name}
                aria-label={c.name}
                onMouseEnter={() => c.image && setImg(c.image)}
                onFocus={() => c.image && setImg(c.image)}
                className="h-3.5 w-3.5 rounded-full border border-black/10 ring-offset-1 hover:ring-1 hover:ring-ink"
                style={{ background: c.hex }}
              />
            ))}
            {p.colors.length > 5 && <span className="text-[11px] text-ink-mute">+{p.colors.length - 5}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

export function ProductGrid({ items }: { items: Card[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((p, i) => (
        <ProductCard key={p.id} p={p} priority={i < 4} />
      ))}
    </div>
  );
}

export function ProductRail({ items }: { items: Card[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
      {items.map((p) => (
        <div key={p.id} className="w-[46%] shrink-0 snap-start sm:w-[31%] lg:w-auto">
          <ProductCard p={p} />
        </div>
      ))}
    </div>
  );
}
