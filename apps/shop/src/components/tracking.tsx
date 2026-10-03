'use client';

import clsx from 'clsx';
import { date } from '@/lib/format';
import type { OrderDetail, ShipmentStatus } from '@/lib/types';
import { CheckIcon, TruckIcon } from './icons';

const STEPS: { key: ShipmentStatus[]; label: string }[] = [
  { key: ['created', 'assigned'], label: 'Packed' },
  { key: ['picked_up', 'in_transit'], label: 'Shipped' },
  { key: ['out_for_delivery', 'failed_attempt'], label: 'Out for delivery' },
  { key: ['delivered'], label: 'Delivered' },
];

export function ShipmentTracker({ s }: { s: OrderDetail['shipments'][number] }) {
  const cancelled = s.status === 'cancelled' || s.status === 'returned_to_vendor';
  const current = STEPS.findIndex((st) => st.key.includes(s.status));
  const events = [...s.events].reverse();

  return (
    <div>
      {!cancelled ? (
        <ol className="relative grid grid-cols-4" aria-label="Delivery progress">
          <div className="absolute left-[12.5%] right-[12.5%] top-4 h-0.5 bg-paper-line" />
          <div className="absolute left-[12.5%] top-4 h-0.5 bg-leaf transition-all" style={{ width: `${(Math.max(0, current) / 3) * 75}%` }} />
          {STEPS.map((st, i) => {
            const done = i <= current;
            return (
              <li key={st.label} className="relative flex flex-col items-center text-center">
                <span className={clsx('z-10 grid h-8 w-8 place-items-center rounded-full border-2', done ? 'border-leaf bg-leaf text-white' : 'border-paper-line bg-white text-ink-mute', i === current && 'ring-4 ring-leaf/20')}>
                  {done ? <CheckIcon size={14} /> : <span className="h-2 w-2 rounded-full bg-paper-line" />}
                </span>
                <span className={clsx('mt-2 text-[11px] font-semibold sm:text-xs', done ? 'text-ink' : 'text-ink-mute')}>{st.label}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl bg-clay-tint px-4 py-3 text-sm font-medium text-clay-dark">This shipment was cancelled.</p>
      )}

      {s.status === 'out_for_delivery' && s.deliveryOtp && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink px-5 py-4 text-white">
          <div className="flex items-center gap-3">
            <TruckIcon className="text-white/70" />
            <div>
              <p className="text-sm font-semibold">{s.agent?.name ?? 'Your delivery partner'} is on the way</p>
              <p className="text-xs text-white/60">{s.agent?.vehicle ? `On a ${s.agent.vehicle}` : ''}{s.agent?.phone ? ` · ${s.agent.phone}` : ''}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">Delivery OTP</p>
            <p className="font-mono text-2xl font-bold tracking-[0.3em]">{s.deliveryOtp}</p>
          </div>
        </div>
      )}

      <details className="group mt-6">
        <summary className="cursor-pointer list-none text-xs font-semibold underline">View all updates ({s.events.length})</summary>
        <ol className="mt-4 space-y-0 border-l-2 border-paper-line pl-5">
          {events.map((e, i) => (
            <li key={i} className="relative pb-5 last:pb-0">
              <span className={clsx('absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white', i === 0 ? 'bg-leaf' : 'bg-paper-line')} />
              <p className="text-sm font-medium">{e.description}</p>
              <p className="text-xs text-ink-mute">{[e.location, date(e.at, true)].filter(Boolean).join(' · ')}</p>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
