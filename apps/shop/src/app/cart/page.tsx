'use client';

import Link from 'next/link';
import { LineItem } from '@/components/line-item';
import { useAuth, useBag } from '@/components/providers';
import { CouponBox, PriceSummary } from '@/components/summary';
import { Empty } from '@/components/ui';
import { inr } from '@/lib/format';
import { ShieldIcon } from '@/components/icons';

export default function CartPage() {
  const bag = useBag();
  const { user } = useAuth();
  const q = bag.quote;

  if (!q) return <div className="container-page py-10"><div className="skeleton h-96" /></div>;
  if (!q.lines.length)
    return (
      <div className="container-page py-12">
        <Empty title="Your bag is empty" body="Save pieces to your wishlist or keep browsing the new arrivals." action={<div className="flex gap-3"><Link href="/shop/women" className="btn-primary">Shop now</Link><Link href="/wishlist" className="btn-outline">Wishlist</Link></div>} />
      </div>
    );

  return (
    <div className="container-page py-10">
      <h1 className="font-display text-4xl">Bag <span className="text-ink-mute">({q.itemCount})</span></h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div>
          {q.amountToFreeShipping > 0 && (
            <div className="mb-4 rounded-2xl bg-leaf-tint px-5 py-4 text-sm text-leaf">Add <b>{inr(q.amountToFreeShipping)}</b> more to get <b>free delivery</b>.</div>
          )}
          {q.hasIssues && <div className="mb-4 rounded-2xl bg-clay-tint px-5 py-4 text-sm text-clay-dark">Some items need your attention before checkout.</div>}
          <ul className="card divide-y divide-paper-line px-5">
            {q.lines.map((l) => <li key={l.variantId} className="py-5"><LineItem line={l} /></li>)}
          </ul>
        </div>
        <aside className="space-y-5 lg:sticky lg:top-32 lg:self-start">
          <div className="card p-5"><CouponBox /></div>
          <div className="card p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em]">Price details</h2>
            <PriceSummary q={q} />
            <Link href={user ? '/checkout' : '/login?next=/checkout'} aria-disabled={q.hasIssues} className={`btn-accent mt-5 w-full py-4 ${q.hasIssues ? 'pointer-events-none opacity-50' : ''}`}>
              {user ? 'Proceed to checkout' : 'Log in to checkout'}
            </Link>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-ink-mute"><ShieldIcon size={14} /> Safe & secure payments</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
