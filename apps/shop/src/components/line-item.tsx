'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useState } from 'react';
import { inr } from '@/lib/format';
import type { CartLine, ProductDetail } from '@/lib/types';
import { MinusIcon, PlusIcon, TrashIcon } from './icons';
import { useBag, useWishlist } from './providers';

export function LineItem({ line, compact }: { line: CartLine; compact?: boolean }) {
  const bag = useBag();
  const wl = useWishlist();
  const [busy, setBusy] = useState(false);
  const [editSize, setEditSize] = useState(false);
  const { data: product } = useSWR<ProductDetail>(editSize ? `/products/${line.slug}` : null);
  const sizes = product?.colors.find((c) => c.id === line.color.id)?.sizes ?? [];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };
  const maxQty = Math.min(10, Math.max(line.available, 1));

  return (
    <div className={`flex gap-4 ${busy ? 'opacity-60' : ''}`}>
      <Link href={`/p/${line.slug}`} className="shrink-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={line.image ?? ''} alt={line.name} className={`${compact ? 'h-28 w-[88px]' : 'h-36 w-28'} rounded-xl bg-paper-warm object-cover`} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            {line.brand && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">{line.brand}</p>}
            <Link href={`/p/${line.slug}`} className="line-clamp-2 text-sm font-medium hover:underline">{line.name}</Link>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{inr(line.lineTotal)}</p>
            {line.lineMrp > line.lineTotal && <p className="text-xs text-ink-mute line-through">{inr(line.lineMrp)}</p>}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border border-black/10" style={{ background: line.color.hex }} />{line.color.name}</span>
          <span className="text-paper-line">|</span>
          {editSize ? (
            <select
              autoFocus
              className="rounded-md border border-paper-line bg-white px-2 py-1"
              defaultValue={line.variantId}
              onBlur={() => setEditSize(false)}
              onChange={(e) => run(async () => { await bag.changeSize(line, Number(e.target.value)); setEditSize(false); })}
            >
              {!sizes.length && <option>Loading…</option>}
              {sizes.map((s) => (
                <option key={s.variantId} value={s.variantId} disabled={!s.available}>{s.code}{!s.available ? ' (sold out)' : ''}</option>
              ))}
            </select>
          ) : (
            <button onClick={() => setEditSize(true)} className="underline decoration-dotted underline-offset-2">Size {line.size}</button>
          )}
        </div>

        {line.issue && (
          <p className="mt-2 text-xs font-medium text-clay">
            {line.issue === 'insufficient_stock' ? `Only ${line.available} left, please reduce quantity` : line.issue === 'out_of_stock' ? 'This size just sold out' : 'No longer available'}
          </p>
        )}
        {!line.issue && line.available <= 3 && <p className="mt-2 text-xs font-medium text-clay">Only {line.available} left</p>}

        <div className="mt-auto flex items-center justify-between pt-3">
          <div className="inline-flex items-center rounded-full border border-paper-line bg-white">
            <button className="p-2 disabled:opacity-30" disabled={busy || line.quantity <= 1} onClick={() => run(() => bag.setQty(line, line.quantity - 1))} aria-label="Decrease quantity"><MinusIcon size={14} /></button>
            <span className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
            <button className="p-2 disabled:opacity-30" disabled={busy || line.quantity >= maxQty} onClick={() => run(() => bag.setQty(line, line.quantity + 1))} aria-label="Increase quantity"><PlusIcon size={14} /></button>
          </div>
          <div className="flex items-center gap-1">
            {!compact && (
              <button className="btn-ghost text-xs" onClick={() => run(async () => { if (!wl.has(line.productId)) await wl.toggle(line.productId); await bag.remove(line); })}>
                Move to wishlist
              </button>
            )}
            <button className="btn-ghost rounded-full p-2" onClick={() => run(() => bag.remove(line))} aria-label="Remove"><TrashIcon size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
