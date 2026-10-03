'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { inr } from '@/lib/format';
import type { ProductDetail } from '@/lib/types';
import { BagIcon, ChevronDown, HeartIcon, PinIcon, ReturnIcon, RulerIcon, TruckIcon } from './icons';
import { useBag, useWishlist } from './providers';
import { Price, Spinner, Stars } from './ui';

const SIZE_GUIDE: Record<string, [string, string, string][]> = {
  adult_alpha: [['XS', '34', '28'], ['S', '36', '30'], ['M', '38–40', '32'], ['L', '42', '34'], ['XL', '44', '36'], ['XXL', '46', '38'], ['3XL', '48', '40']],
  adult_numeric: [['28', '28', '36'], ['30', '30', '38'], ['32', '32', '40'], ['34', '34', '42'], ['36', '36', '44'], ['38', '38', '46']],
  kids_age: [['2-3Y', '21', '92–98'], ['4-5Y', '23', '104–110'], ['7-8Y', '25', '122–128'], ['9-10Y', '27', '134–140'], ['11-12Y', '29', '146–152']],
};

export function ProductView({ p }: { p: ProductDetail }) {
  const bag = useBag();
  const wl = useWishlist();
  const router = useRouter();
  const sp = useSearchParams();
  const initialColor = p.colors.find((c) => String(c.id) === sp.get('color')) ?? p.colors.find((c) => c.sizes.some((s) => s.available)) ?? p.colors[0];
  const [colorId, setColorId] = useState(initialColor.id);
  const color = p.colors.find((c) => c.id === colorId)!;
  const [imgIdx, setImgIdx] = useState(0);
  const [variantId, setVariantId] = useState<number | null>(color.sizes.length === 1 ? color.sizes[0].variantId : null);
  const [sizeError, setSizeError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [guide, setGuide] = useState(false);
  const [pin, setPin] = useState('');
  const [eta, setEta] = useState<string | null>(null);

  const size = color.sizes.find((s) => s.variantId === variantId);
  const price = size?.price ?? Math.min(...color.sizes.map((s) => s.price));
  const mrp = size?.mrp ?? color.sizes.find((s) => s.price === price)?.mrp ?? p.mrp;
  const soldOut = color.sizes.every((s) => !s.available);
  const saved = wl.has(p.id);

  const pickColor = (id: number) => {
    setColorId(id);
    setImgIdx(0);
    const next = p.colors.find((c) => c.id === id)!;
    const same = next.sizes.find((s) => s.code === size?.code && s.available);
    setVariantId(same?.variantId ?? (next.sizes.length === 1 ? next.sizes[0].variantId : null));
    const u = new URLSearchParams(sp.toString());
    u.set('color', String(id));
    router.replace(`?${u}`, { scroll: false });
  };

  const addToBag = async (buyNow = false) => {
    if (!variantId) {
      setSizeError(true);
      return;
    }
    setAdding(true);
    const ok = await bag.add(variantId, 1);
    setAdding(false);
    if (ok && buyNow) {
      bag.openDrawer(false);
      router.push('/checkout');
    }
  };

  const checkPin = () => {
    if (!/^[1-9][0-9]{5}$/.test(pin)) return setEta('Enter a valid 6-digit PIN code');
    const metro = ['11', '40', '56', '60', '50', '70', '41', '38'].includes(pin.slice(0, 2));
    const d = new Date(Date.now() + (metro ? 3 : 6) * 86400000);
    setEta(`Delivery by ${d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}${price >= 999 ? ' · Free' : ''} · COD available`);
  };

  const fitTotal = useMemo(() => Object.values(p.fitSummary).reduce((a, b) => a + b, 0), [p.fitSummary]);

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
      {/* gallery */}
      <div className="lg:sticky lg:top-32 lg:self-start">
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <div className="no-scrollbar flex gap-3 overflow-x-auto sm:w-20 sm:flex-col">
            {color.images.map((img, i) => (
              <button key={img.url} onClick={() => setImgIdx(i)} className={clsx('shrink-0 overflow-hidden rounded-xl border-2 transition', i === imgIdx ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.thumb} alt={img.alt} className="h-24 w-20 object-cover" />
              </button>
            ))}
          </div>
          <div className="relative flex-1 overflow-hidden rounded-3xl bg-paper-warm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={color.images[imgIdx]?.url} alt={color.images[imgIdx]?.alt} className="aspect-[4/5] w-full object-cover" />
            {p.discountPct > 0 && <span className="absolute left-4 top-4 rounded-full bg-clay px-3 py-1 text-xs font-bold text-white">{p.discountPct}% OFF</span>}
          </div>
        </div>
      </div>

      {/* buy box */}
      <div>
        {p.brand && <Link href={`/search?q=${encodeURIComponent(p.brand.name)}`} className="eyebrow hover:text-ink">{p.brand.name}</Link>}
        <h1 className="mt-2 font-display text-3xl leading-tight sm:text-4xl">{p.name}</h1>
        {p.ratingCount > 0 && (
          <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm">
            <Stars value={p.rating} /> <span className="font-semibold">{p.rating.toFixed(1)}</span> <span className="text-ink-mute underline">{p.ratingCount} reviews</span>
          </a>
        )}
        <div className="mt-5">
          <Price price={price} mrp={mrp} size="lg" />
          <p className="mt-1 text-xs text-ink-mute">Inclusive of all taxes</p>
        </div>

        {/* colours */}
        <div className="mt-8">
          <p className="text-sm"><span className="font-semibold">Colour:</span> {color.name}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {p.colors.map((c) => (
              <button key={c.id} onClick={() => pickColor(c.id)} title={c.name} aria-label={c.name} aria-pressed={c.id === colorId}
                className={clsx('relative overflow-hidden rounded-xl border-2 transition', c.id === colorId ? 'border-ink' : 'border-transparent hover:border-paper-line')}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.images[0]?.thumb} alt="" className={clsx('h-16 w-14 object-cover', c.sizes.every((s) => !s.available) && 'opacity-40')} />
                <span className="absolute bottom-1 right-1 h-3 w-3 rounded-full border border-white shadow" style={{ background: c.hex }} />
              </button>
            ))}
          </div>
        </div>

        {/* sizes */}
        {!(color.sizes.length === 1 && color.sizes[0].code === 'FREE') && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <p className={clsx('text-sm', sizeError && 'text-clay')}>
                <span className="font-semibold">Size:</span> {size ? size.label : sizeError ? 'Please select a size' : 'Select a size'}
              </p>
              {SIZE_GUIDE[p.sizeGroup] && (
                <button onClick={() => setGuide(!guide)} className="inline-flex items-center gap-1 text-xs font-semibold underline"><RulerIcon size={14} /> Size guide</button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {color.sizes.map((s) => (
                <button
                  key={s.variantId}
                  disabled={!s.available}
                  onClick={() => { setVariantId(s.variantId); setSizeError(false); }}
                  className={clsx(
                    'relative h-12 min-w-14 rounded-xl border px-3 text-sm font-medium transition',
                    s.variantId === variantId ? 'border-ink bg-ink text-white' : 'border-paper-line bg-white hover:border-ink',
                    !s.available && 'cursor-not-allowed border-dashed text-ink-mute line-through hover:border-paper-line',
                  )}
                >
                  {s.code}
                  {s.lowStock && <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-clay px-1.5 text-[9px] font-bold text-white no-underline">{s.available} left</span>}
                </button>
              ))}
            </div>
            {guide && SIZE_GUIDE[p.sizeGroup] && (
              <table className="mt-4 w-full overflow-hidden rounded-xl border border-paper-line bg-white text-left text-xs">
                <thead className="bg-paper-warm"><tr>{(p.sizeGroup === 'kids_age' ? ['Age', 'Chest (in)', 'Height (cm)'] : p.sizeGroup === 'adult_numeric' ? ['Size', 'Waist (in)', 'Length (in)'] : ['Size', 'Chest (in)', 'Waist (in)']).map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{SIZE_GUIDE[p.sizeGroup].map((r) => <tr key={r[0]} className="border-t border-paper-line">{r.map((c, i) => <td key={i} className="px-3 py-2">{c}</td>)}</tr>)}</tbody>
              </table>
            )}
            {fitTotal > 0 && (
              <p className="mt-4 text-xs text-ink-mute">
                Fit: <b className="text-ink">{Math.round(((p.fitSummary.true_to_size ?? 0) / fitTotal) * 100)}%</b> of reviewers say it’s true to size
              </p>
            )}
          </div>
        )}

        {/* actions */}
        <div className="mt-8 flex gap-3">
          <button onClick={() => addToBag()} disabled={adding || soldOut} className="btn-primary flex-1 py-4">
            {adding ? <Spinner /> : <BagIcon size={18} />} {soldOut ? 'Sold out' : 'Add to bag'}
          </button>
          <button onClick={() => wl.toggle(p.id)} className={clsx('btn-outline px-4', saved && 'border-clay text-clay')} aria-label="Wishlist">
            <HeartIcon size={20} filled={saved} />
          </button>
        </div>
        {!soldOut && <button onClick={() => addToBag(true)} disabled={adding} className="btn-accent mt-3 w-full py-4">Buy now</button>}

        {/* delivery */}
        <div className="mt-8 rounded-2xl border border-paper-line bg-white p-5">
          <p className="flex items-center gap-2 text-sm font-semibold"><PinIcon size={18} /> Check delivery</p>
          <div className="mt-3 flex gap-2">
            <input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Enter PIN code" inputMode="numeric" className="input py-2.5" />
            <button onClick={checkPin} className="btn-outline px-5 py-2">Check</button>
          </div>
          {eta && <p className={clsx('mt-3 text-xs', eta.startsWith('Enter') ? 'text-clay' : 'text-leaf')}>{eta}</p>}
          <div className="mt-4 grid gap-3 text-xs text-ink-soft sm:grid-cols-2">
            <p className="flex items-center gap-2"><TruckIcon size={16} /> Free delivery above {inr(999)}</p>
            <p className="flex items-center gap-2"><ReturnIcon size={16} /> 15-day easy returns & exchange</p>
          </div>
          <p className="mt-3 text-xs text-ink-mute">Sold by <b className="text-ink">{p.vendor.display_name}</b> · Seller rating {Number(p.vendor.rating_avg).toFixed(1)}</p>
        </div>

        {/* details */}
        <div className="mt-8 divide-y divide-paper-line border-y border-paper-line">
          <Acc title="Product details" open>
            {p.description && <p className="mb-4 leading-relaxed">{p.description}</p>}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {p.specs.map((s) => (
                <div key={s.label}><dt className="text-xs text-ink-mute">{s.label}</dt><dd className="text-sm">{s.value}</dd></div>
              ))}
              {size && <div><dt className="text-xs text-ink-mute">SKU</dt><dd className="text-sm">{size.sku}</dd></div>}
            </dl>
          </Acc>
          {p.careInstructions && <Acc title="Care">{p.careInstructions}</Acc>}
          <Acc title="Returns & exchange">Easy 15-day returns and size exchanges. Items must be unused with tags intact. Refunds for prepaid orders go back to the original payment method within 5–7 days.</Acc>
        </div>
      </div>
    </div>
  );
}

function Acc({ title, children, open }: { title: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group py-5" open={open}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold">
        {title} <ChevronDown size={18} className="transition group-open:rotate-180" />
      </summary>
      <div className="mt-4 text-sm text-ink-soft">{children}</div>
    </details>
  );
}
