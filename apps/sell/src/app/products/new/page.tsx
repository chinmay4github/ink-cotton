'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { api, ApiError } from '@ic/ui/api';
import { Money, PageHeader, Spinner } from '@ic/ui/components';
import { useToast } from '@ic/ui/staff';
import { Gate } from '@/lib/gate';

interface Meta {
  categories: { id: number; name: string; department: string; slug: string }[];
  colors: { id: number; name: string; hex: string }[];
  sizes: { id: number; code: string; label: string; size_group: string }[];
  kinds: string[];
}
const KIND_LABEL: Record<string, string> = {
  tshirt: 'T-shirt', polo: 'Polo', shirt: 'Shirt', jacket: 'Jacket', hoodie: 'Hoodie / sweater', jeans: 'Jeans', chinos: 'Trousers / chinos', shorts: 'Shorts',
  kurta: 'Kurta', dress: 'Dress', top: 'Top', saree: 'Saree', frock: 'Frock', romper: 'Romper', sneaker: 'Footwear',
};
const GROUP_LABEL: Record<string, string> = { adult_alpha: 'Adult (XS–3XL)', adult_numeric: 'Waist (28–40)', kids_age: 'Kids (age)', footwear: 'Shoe (UK)', free_size: 'Free size' };

function NewProduct() {
  const router = useRouter();
  const toast = useToast();
  const { data: meta } = useSWR<Meta>('/seller/meta');
  const [f, setF] = useState({
    name: '', department: 'women' as 'men' | 'women' | 'kids', categoryId: 0, kind: 'tshirt', shortDescription: '', description: '', material: '', fit: 'Regular',
    price: 999, mrp: 1499, stockPerVariant: 20, photoUrl: '',
  });
  const [colorIds, setColors] = useState<number[]>([]);
  const [group, setGroup] = useState('adult_alpha');
  const [sizeIds, setSizes] = useState<number[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const cats = useMemo(() => meta?.categories.filter((c) => c.department === f.department) ?? [], [meta, f.department]);
  const groupSizes = useMemo(() => meta?.sizes.filter((s) => s.size_group === group) ?? [], [meta, group]);
  const firstHex = meta?.colors.find((c) => c.id === colorIds[0])?.hex.slice(1) ?? '1F2A44';
  const preview = f.photoUrl.startsWith('https://') ? f.photoUrl : `/img/${f.kind}/${firstHex}/front.svg`;
  const variants = colorIds.length * sizeIds.length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!f.categoryId) return setErr('Pick a category');
    if (!colorIds.length) return setErr('Pick at least one colour');
    if (!sizeIds.length) return setErr('Pick at least one size');
    setBusy(true);
    try {
      const p = await api<{ id: number }>('/seller/products', {
        method: 'POST',
        json: { ...f, categoryId: Number(f.categoryId), price: Number(f.price), mrp: Number(f.mrp), stockPerVariant: Number(f.stockPerVariant), colorIds, sizeIds, photoUrl: f.photoUrl || undefined, material: f.material || undefined, shortDescription: f.shortDescription || undefined, description: f.description || undefined },
      });
      toast('Submitted for review. It goes live once approved.');
      router.push(`/products/${p.id}`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not save');
      setBusy(false);
    }
  };

  if (!meta) return <div className="skeleton h-96" />;
  return (
    <>
      <PageHeader eyebrow="Catalogue" title="Add a product" actions={<Link href="/products" className="btn-ghost">Cancel</Link>} />
      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <section className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Basics</h2>
            <div><label className="label" htmlFor="name">Product name</label><input id="name" className="input" required minLength={3} value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Block-print Cotton Kurta" /></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="dept">Department</label>
                <select id="dept" className="input" value={f.department} onChange={(e) => { set('department', e.target.value as any); set('categoryId', 0); if (e.target.value === 'kids') setGroup('kids_age'); }}>
                  <option value="women">Women</option><option value="men">Men</option><option value="kids">Kids</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="cat">Category</label>
                <select id="cat" className="input" value={f.categoryId} onChange={(e) => set('categoryId', Number(e.target.value))} required>
                  <option value={0} disabled>Choose…</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="kind">Garment type</label>
                <select id="kind" className="input" value={f.kind} onChange={(e) => set('kind', e.target.value)}>
                  {meta.kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k] ?? k}</option>)}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><label className="label" htmlFor="mat">Material</label><input id="mat" className="input" value={f.material} onChange={(e) => set('material', e.target.value)} placeholder="100% Cotton" /></div>
              <div><label className="label" htmlFor="fit">Fit</label><input id="fit" className="input" value={f.fit} onChange={(e) => set('fit', e.target.value)} /></div>
            </div>
            <div><label className="label" htmlFor="sd">Short description</label><input id="sd" className="input" maxLength={500} value={f.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} placeholder="One line shoppers see under the name" /></div>
            <div><label className="label" htmlFor="d">Details</label><textarea id="d" className="input min-h-[90px]" maxLength={4000} value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Colours &amp; sizes</h2>
            <div>
              <p className="label">Colours</p>
              <div className="flex flex-wrap gap-2">
                {meta.colors.map((c) => {
                  const on = colorIds.includes(c.id);
                  return (
                    <button type="button" key={c.id} onClick={() => setColors((x) => (on ? x.filter((i) => i !== c.id) : [...x, c.id]))} className={clsx('chip', on && 'border-ink bg-ink text-white')}>
                      <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: c.hex }} /> {c.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="label">Size chart</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(GROUP_LABEL).map(([g, l]) => (
                  <button type="button" key={g} onClick={() => { setGroup(g); setSizes([]); }} className={clsx('chip', group === g && 'border-ink bg-ink text-white')}>{l}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between"><p className="label">Sizes</p><button type="button" className="text-xs font-semibold underline" onClick={() => setSizes(groupSizes.map((s) => s.id))}>Select all</button></div>
              <div className="flex flex-wrap gap-2">
                {groupSizes.map((s) => {
                  const on = sizeIds.includes(s.id);
                  return <button type="button" key={s.id} onClick={() => setSizes((x) => (on ? x.filter((i) => i !== s.id) : [...x, s.id]))} className={clsx('min-w-12 rounded-lg border px-3 py-2 text-sm', on ? 'border-ink bg-ink text-white' : 'border-paper-line bg-white')}>{s.code}</button>;
                })}
              </div>
            </div>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em]">Price, stock &amp; photo</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label className="label" htmlFor="price">Selling price (₹)</label><input id="price" type="number" min={49} className="input" value={f.price} onChange={(e) => set('price', Number(e.target.value))} required /></div>
              <div><label className="label" htmlFor="mrp">MRP (₹)</label><input id="mrp" type="number" min={49} className="input" value={f.mrp} onChange={(e) => set('mrp', Number(e.target.value))} required /></div>
              <div><label className="label" htmlFor="stock">Stock per variant</label><input id="stock" type="number" min={0} className="input" value={f.stockPerVariant} onChange={(e) => set('stockPerVariant', Number(e.target.value))} required /></div>
            </div>
            <div>
              <label className="label" htmlFor="photo">Model photo URL (optional)</label>
              <input id="photo" type="url" className="input" value={f.photoUrl} onChange={(e) => set('photoUrl', e.target.value)} placeholder="https://… (a photo of a model wearing it)" />
              <p className="mt-1.5 text-xs text-ink-mute">Without a photo, the shop shows a product illustration in each colour.</p>
            </div>
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="card overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="aspect-[4/5] w-full bg-paper-warm object-cover" />
            <div className="space-y-1 p-4">
              <p className="line-clamp-2 text-sm font-medium">{f.name || 'Product name'}</p>
              <Money value={Number(f.price) || 0} mrp={Number(f.mrp) || 0} />
              <p className="text-xs text-ink-mute">{variants} variant{variants === 1 ? '' : 's'} · {variants * (Number(f.stockPerVariant) || 0)} units</p>
            </div>
          </div>
          {err && <p className="rounded-lg bg-clay-tint px-3 py-2 text-sm text-clay-dark">{err}</p>}
          <button className="btn-primary w-full" disabled={busy}>{busy && <Spinner />} Submit for review</button>
          <p className="text-xs text-ink-mute">Our catalogue team checks new listings, usually within a few hours.</p>
        </aside>
      </form>
    </>
  );
}

export default function Page() {
  return <Gate><NewProduct /></Gate>;
}
