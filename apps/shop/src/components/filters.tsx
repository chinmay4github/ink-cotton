'use client';

import clsx from 'clsx';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { inr } from '@/lib/format';
import type { Facets } from '@/lib/types';
import { CheckIcon, ChevronDown, FilterIcon, XIcon } from './icons';

export const SORT_OPTIONS = [
  ['relevance', 'Recommended'],
  ['newest', 'Newest first'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
  ['rating', 'Top rated'],
  ['discount', 'Biggest discount'],
] as const;

const PRICE_BUCKETS: [number, number | null, string][] = [
  [0, 999, 'Under ₹999'],
  [1000, 1999, '₹1,000 – ₹1,999'],
  [2000, 3999, '₹2,000 – ₹3,999'],
  [4000, null, '₹4,000 & above'],
];

function useParamsEditor() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const list = (k: string) => (params.get(k) ?? '').split(',').filter(Boolean);
  const push = (mutate: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params.toString());
    mutate(p);
    p.delete('page');
    start(() => router.push(`${pathname}?${p.toString()}`, { scroll: false }));
  };
  const toggle = (k: string, v: string) =>
    push((p) => {
      const cur = new Set(list(k));
      cur.has(v) ? cur.delete(v) : cur.add(v);
      cur.size ? p.set(k, [...cur].join(',')) : p.delete(k);
    });
  return { params, list, push, toggle, pending };
}

function Group({ title, children, open = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [o, setO] = useState(open);
  return (
    <div className="border-b border-paper-line py-5">
      <button onClick={() => setO(!o)} className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-[0.14em]">
        {title} <ChevronDown size={16} className={clsx('transition', o && 'rotate-180')} />
      </button>
      {o && <div className="mt-4">{children}</div>}
    </div>
  );
}

function FilterBody({ facets }: { facets: Facets }) {
  const { list, toggle, push, params } = useParamsEditor();
  const colors = list('colors');
  const sizes = list('sizes');
  const brands = list('brands');
  const min = params.get('minPrice');
  const max = params.get('maxPrice');

  return (
    <div>
      {facets.sizes.length > 0 && (
        <Group title="Size">
          <div className="flex flex-wrap gap-2">
            {facets.sizes.map((s) => (
              <button
                key={s.code}
                onClick={() => toggle('sizes', s.code)}
                className={clsx('min-w-11 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition', sizes.includes(s.code) ? 'border-ink bg-ink text-white' : 'border-paper-line bg-white hover:border-ink')}
                title={s.label}
              >
                {s.code}
              </button>
            ))}
          </div>
        </Group>
      )}
      {facets.colors.length > 0 && (
        <Group title="Colour">
          <div className="grid grid-cols-2 gap-2">
            {facets.colors.map((c) => (
              <button key={c.id} onClick={() => toggle('colors', String(c.id))} className="flex items-center gap-2 text-left text-sm text-ink-soft hover:text-ink">
                <span className={clsx('grid h-5 w-5 place-items-center rounded-full border', colors.includes(String(c.id)) ? 'border-ink ring-2 ring-ink ring-offset-1' : 'border-black/10')} style={{ background: c.hex }}>
                  {colors.includes(String(c.id)) && <CheckIcon size={12} className={c.hex.toUpperCase() > '#AAAAAA' ? 'text-ink' : 'text-white'} />}
                </span>
                <span className="truncate">{c.name}</span>
                <span className="ml-auto text-xs text-ink-mute">{c.count}</span>
              </button>
            ))}
          </div>
        </Group>
      )}
      <Group title="Price">
        <div className="space-y-2">
          {PRICE_BUCKETS.filter(([lo]) => lo <= facets.price.max).map(([lo, hi, label]) => {
            const on = min === String(lo) && (hi == null ? !max : max === String(hi));
            return (
              <button
                key={label}
                onClick={() => push((p) => {
                  if (on) { p.delete('minPrice'); p.delete('maxPrice'); return; }
                  p.set('minPrice', String(lo));
                  hi == null ? p.delete('maxPrice') : p.set('maxPrice', String(hi));
                })}
                className="flex w-full items-center gap-2 text-sm text-ink-soft hover:text-ink"
              >
                <span className={clsx('grid h-4 w-4 place-items-center rounded-full border', on ? 'border-ink bg-ink' : 'border-ink/30')}>{on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
                {label}
              </button>
            );
          })}
          <p className="pt-1 text-xs text-ink-mute">Range in this view: {inr(facets.price.min)} – {inr(facets.price.max)}</p>
        </div>
      </Group>
      {facets.brands.length > 1 && (
        <Group title="Brand">
          <div className="space-y-2">
            {facets.brands.map((b) => (
              <label key={b.slug} className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft hover:text-ink">
                <input type="checkbox" className="h-4 w-4 rounded accent-ink" checked={brands.includes(b.slug)} onChange={() => toggle('brands', b.slug)} />
                {b.name} <span className="ml-auto text-xs text-ink-mute">{b.count}</span>
              </label>
            ))}
          </div>
        </Group>
      )}
    </div>
  );
}

export function ActiveFilters({ facets }: { facets: Facets }) {
  const { list, push, toggle } = useParamsEditor();
  const chips: { label: string; onClear: () => void }[] = [
    ...list('sizes').map((s) => ({ label: `Size ${s}`, onClear: () => toggle('sizes', s) })),
    ...list('colors').map((c) => ({ label: facets.colors.find((x) => String(x.id) === c)?.name ?? 'Colour', onClear: () => toggle('colors', c) })),
    ...list('brands').map((b) => ({ label: facets.brands.find((x) => x.slug === b)?.name ?? b, onClear: () => toggle('brands', b) })),
  ];
  const { params } = useParamsEditor();
  if (params.get('minPrice')) chips.push({ label: `${inr(Number(params.get('minPrice')))}${params.get('maxPrice') ? ` – ${inr(Number(params.get('maxPrice')))}` : '+'}`, onClear: () => push((p) => { p.delete('minPrice'); p.delete('maxPrice'); }) });
  if (!chips.length) return null;
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button key={c.label} onClick={c.onClear} className="chip hover:border-ink">{c.label} <XIcon size={12} /></button>
      ))}
      <button onClick={() => push((p) => ['sizes', 'colors', 'brands', 'minPrice', 'maxPrice'].forEach((k) => p.delete(k)))} className="text-xs font-semibold underline">Clear all</button>
    </div>
  );
}

export function SortSelect() {
  const { params, push, pending } = useParamsEditor();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-ink-mute sm:inline">Sort by</span>
      <select
        value={params.get('sort') ?? 'relevance'}
        onChange={(e) => push((p) => (e.target.value === 'relevance' ? p.delete('sort') : p.set('sort', e.target.value)))}
        className={clsx('rounded-full border border-paper-line bg-white px-4 py-2 font-medium', pending && 'opacity-60')}
      >
        {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export function FilterSidebar({ facets }: { facets: Facets }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto pr-2 no-scrollbar">
          <FilterBody facets={facets} />
        </div>
      </aside>
      <button onClick={() => setOpen(true)} className="btn-outline px-4 py-2 lg:hidden"><FilterIcon size={16} /> Filters</button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-paper px-5 pb-24 pt-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Filters</h2>
              <button onClick={() => setOpen(false)} aria-label="Close filters"><XIcon /></button>
            </div>
            <FilterBody facets={facets} />
            <div className="fixed inset-x-0 bottom-0 border-t border-paper-line bg-white p-4">
              <button onClick={() => setOpen(false)} className="btn-primary w-full">Show results</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
