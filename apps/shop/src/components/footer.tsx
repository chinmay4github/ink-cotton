import Link from 'next/link';
import type { NavDept } from '@/lib/types';
import { CashIcon, ReturnIcon, ShieldIcon, TruckIcon } from './icons';

export function Promises() {
  const items = [
    [TruckIcon, 'Free delivery', 'On orders above ₹999'],
    [ReturnIcon, '15-day returns', 'Easy pickup from your door'],
    [CashIcon, 'Cash on delivery', 'Pay when it arrives'],
    [ShieldIcon, 'Secure payments', 'UPI, cards & net banking'],
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map(([Icon, t, s]) => (
        <div key={t} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-paper-warm text-clay"><Icon size={20} /></span>
          <div>
            <p className="text-sm font-semibold">{t}</p>
            <p className="text-xs text-ink-mute">{s}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Footer({ nav }: { nav: NavDept[] }) {
  return (
    <footer className="mt-24 bg-ink text-white/80">
      <div className="container-page grid gap-10 py-14 md:grid-cols-5">
        <div className="md:col-span-2">
          <p className="font-display text-2xl text-white">Ink <span className="italic text-[#E7C98B]">&amp;</span> Cotton</p>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/60">
            Everyday clothing for men, women and kids, made with honest cotton and careful craft.
          </p>
        </div>
        {nav.map((d) => (
          <div key={d.department}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white">{d.label}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {d.categories.map((c) => (
                <li key={c.id}><Link className="hover:text-white" href={`/shop/${d.department}/${c.slug}`}>{c.name}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-white/50 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Ink &amp; Cotton. Model photography via Unsplash.</p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <a className="hover:text-white" href={process.env.NEXT_PUBLIC_SELL_URL ?? 'http://localhost:3001'}>Sell on Ink &amp; Cotton</a>
            <a className="hover:text-white" href={process.env.NEXT_PUBLIC_DELIVER_URL ?? 'http://localhost:3002'}>Deliver with us</a>
            <span>Help · Shipping · Returns · Privacy</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
