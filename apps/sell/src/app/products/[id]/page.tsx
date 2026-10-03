'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@ic/ui/api';
import { Money, PageHeader, Spinner, Status } from '@ic/ui/components';
import { useAction } from '@ic/ui/staff';
import { Gate } from '@/lib/gate';
import { SHOP_URL } from '@/lib/app';

interface Variant { id: number; sku: string; color: string; hex: string; size: string; price: number; mrp: number; stock: number; reserved: number; active: boolean }
interface Product {
  id: number; name: string; slug: string; status: string; department: string; category: string; shortDescription: string | null;
  material: string | null; fit: string | null; price: number; mrp: number; rejectionReason: string | null; images: string[]; variants: Variant[];
}

function VariantRow({ v, onSaved }: { v: Variant; onSaved: () => void }) {
  const [stock, setStock] = useState(String(v.stock));
  const [price, setPrice] = useState(String(v.price));
  const { busy, run } = useAction();
  const dirty = Number(stock) !== v.stock || Number(price) !== v.price;
  const save = () =>
    run('save', async () => {
      await api(`/seller/variants/${v.id}`, { method: 'PATCH', json: { stockQty: Number(stock), price: Number(price) } });
      onSaved();
    }, `${v.sku} updated`);
  return (
    <tr>
      <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2"><span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: v.hex }} />{v.color}</span></td>
      <td className="px-4 py-2.5 font-medium">{v.size}</td>
      <td className="hidden px-4 py-2.5 font-mono text-xs text-ink-mute md:table-cell">{v.sku}</td>
      <td className="px-4 py-2.5"><input aria-label={`Price for ${v.sku}`} type="number" min={49} max={v.mrp} className="w-24 rounded-lg border border-paper-line px-2 py-1.5 text-sm" value={price} onChange={(e) => setPrice(e.target.value)} /></td>
      <td className="px-4 py-2.5">
        <input aria-label={`Stock for ${v.sku}`} type="number" min={v.reserved} className={`w-20 rounded-lg border px-2 py-1.5 text-sm ${v.stock <= 5 ? 'border-clay' : 'border-paper-line'}`} value={stock} onChange={(e) => setStock(e.target.value)} />
        {v.reserved > 0 && <span className="ml-2 text-xs text-ink-mute">{v.reserved} reserved</span>}
      </td>
      <td className="px-4 py-2.5 text-right">{dirty && <button onClick={save} disabled={!!busy} className="btn-primary px-4 py-1.5 text-xs">{busy && <Spinner />} Save</button>}</td>
    </tr>
  );
}

function Detail() {
  const { id } = useParams<{ id: string }>();
  const { data: p, mutate } = useSWR<Product>(`/seller/products/${id}`);
  const { busy, run } = useAction();
  if (!p) return <div className="skeleton h-96" />;
  const total = p.variants.reduce((s, v) => s + v.stock, 0);
  const toggle = () =>
    run('t', async () => {
      await api(`/seller/products/${p.id}`, { method: 'PATCH', json: { status: p.status === 'active' ? 'inactive' : 'active' } });
      await mutate();
    }, p.status === 'active' ? 'Hidden from the shop' : 'Live in the shop');

  return (
    <>
      <p className="mb-3 text-sm"><Link href="/products" className="text-ink-mute hover:text-ink">← Products</Link></p>
      <PageHeader
        title={p.name}
        eyebrow={`${p.department} · ${p.category}`}
        actions={
          <>
            {p.status === 'active' && <a href={`${SHOP_URL}/p/${p.slug}`} target="_blank" className="btn-outline">View in shop</a>}
            {['active', 'inactive'].includes(p.status) && <button onClick={toggle} disabled={!!busy} className="btn-outline">{busy && <Spinner />}{p.status === 'active' ? 'Hide from shop' : 'Show in shop'}</button>}
          </>
        }
      >
        <div className="mt-3 flex items-center gap-3"><Status status={p.status} /><Money value={p.price} mrp={p.mrp} /></div>
      </PageHeader>
      {p.status === 'rejected' && p.rejectionReason && <p className="mb-6 rounded-xl bg-clay-tint px-4 py-3 text-sm text-clay-dark">Not approved: {p.rejectionReason}</p>}
      {p.status === 'pending_approval' && <p className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">In review. You can set stock now; it goes live once the catalogue team approves it.</p>}

      <div className="no-scrollbar mb-6 flex gap-3 overflow-x-auto">
        {p.images.slice(0, 8).map((src) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={src} src={src} alt="" className="h-40 w-32 shrink-0 rounded-xl bg-paper-warm object-cover" />
        ))}
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between border-b border-paper-line px-4 py-3">
          <p className="text-sm font-semibold">Variants &amp; stock</p>
          <p className="text-sm text-ink-mute">{total} units in stock</p>
        </div>
        <table className="w-full min-w-[520px] text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-ink-mute">
            <tr><th className="px-4 py-2 font-semibold">Colour</th><th className="px-4 py-2 font-semibold">Size</th><th className="hidden px-4 py-2 font-semibold md:table-cell">SKU</th><th className="px-4 py-2 font-semibold">Price ₹</th><th className="px-4 py-2 font-semibold">Stock</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-paper-line">
            {p.variants.map((v) => <VariantRow key={`${v.id}-${v.stock}-${v.price}`} v={v} onSaved={() => mutate()} />)}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function Page() {
  return <Gate><Detail /></Gate>;
}
