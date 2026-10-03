'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { inr } from '@/lib/format';
import { BagIcon, XIcon } from './icons';
import { useBag } from './providers';
import { LineItem } from './line-item';

export function BagDrawer() {
  const bag = useBag();
  const q = bag.quote;

  useEffect(() => {
    if (!bag.drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && bag.openDrawer(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [bag.drawerOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!bag.drawerOpen) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-label="Shopping bag">
      <div className="absolute inset-0 bg-ink/40" onClick={() => bag.openDrawer(false)} />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md animate-slide-in flex-col bg-paper shadow-2xl">
        <header className="flex items-center justify-between border-b border-paper-line px-5 py-4">
          <h2 className="font-display text-xl">Your bag {q?.itemCount ? <span className="text-ink-mute">({q.itemCount})</span> : null}</h2>
          <button onClick={() => bag.openDrawer(false)} className="btn-ghost -mr-2 rounded-full p-2" aria-label="Close"><XIcon /></button>
        </header>

        {q && q.amountToFreeShipping > 0 && (
          <div className="border-b border-paper-line bg-leaf-tint px-5 py-3 text-xs text-leaf">
            Add <b>{inr(q.amountToFreeShipping)}</b> more for free delivery
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white">
              <div className="h-full bg-leaf" style={{ width: `${Math.min(100, ((q.freeShippingThreshold - q.amountToFreeShipping) / q.freeShippingThreshold) * 100)}%` }} />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5">
          {!q?.lines.length ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <BagIcon size={40} className="text-ink-mute" />
              <p className="mt-4 font-display text-xl">Your bag is empty</p>
              <p className="mt-1 text-sm text-ink-mute">Pieces you add will show up here.</p>
              <button onClick={() => bag.openDrawer(false)} className="btn-primary mt-6">Continue shopping</button>
            </div>
          ) : (
            <ul className="divide-y divide-paper-line">
              {q.lines.map((l) => (
                <li key={l.variantId} className="py-4"><LineItem line={l} compact /></li>
              ))}
            </ul>
          )}
        </div>

        {!!q?.lines.length && (
          <footer className="space-y-3 border-t border-paper-line bg-white px-5 py-5">
            <div className="flex justify-between text-sm"><span className="text-ink-soft">Subtotal</span><span className="font-semibold">{inr(q.subtotal)}</span></div>
            <p className="text-xs text-ink-mute">Prices include GST. Shipping and coupons are applied at checkout.</p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/cart" onClick={() => bag.openDrawer(false)} className="btn-outline">View bag</Link>
              <Link href="/checkout" onClick={() => bag.openDrawer(false)} className="btn-accent">Checkout</Link>
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}
