'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { api } from '@ic/ui/api';
import { Address, Badge, Spinner, Status, Thumb } from '@ic/ui/components';
import { date, inr } from '@ic/ui/format';
import { useAction } from '@ic/ui/staff';
import { currentPosition, Gate, type Job, STEP_LABEL } from '@/lib/rider';

const PRIMARY: Record<string, { to: string; label: string; place?: (j: Job) => string }> = {
  assigned: { to: 'picked_up', label: 'I’ve picked up the package', place: (j) => j.pickup?.city ?? 'Seller' },
  picked_up: { to: 'in_transit', label: 'Start trip', place: () => 'On the way' },
  in_transit: { to: 'out_for_delivery', label: 'Reached the area · out for delivery', place: (j) => j.drop?.city ?? 'Near customer' },
  failed_attempt: { to: 'out_for_delivery', label: 'Try delivery again', place: (j) => j.drop?.city ?? 'Near customer' },
};

function JobView() {
  const { id } = useParams<{ id: string }>();
  const { data: j, mutate } = useSWR<Job>(`/rider/jobs/${id}`, { refreshInterval: 20_000 });
  const { busy, run } = useAction();
  const [otp, setOtp] = useState('');
  if (!j) return <div className="skeleton h-96" />;

  const step = (status: string, locationName?: string, note?: string) =>
    run(status, async () => {
      const pos = await currentPosition();
      await api('/rider/location', { method: 'POST', json: pos });
      mutate(await api<Job>(`/rider/jobs/${j.id}/status`, { method: 'POST', json: { status, locationName, note } }), false);
    }, STEP_LABEL[status]);
  const deliver = (e: React.FormEvent) => {
    e.preventDefault();
    run('deliver', async () => {
      mutate(await api<Job>(`/rider/jobs/${j.id}/deliver`, { method: 'POST', json: { otp } }), false);
    }, `Delivered! ${j.payment === 'cod' ? `Hand ${inr(j.codAmount)} to the hub.` : ''}`);
  };
  const fail = () => {
    const reason = prompt('Why couldn’t you deliver? (e.g. customer not reachable)');
    if (reason) step('failed_attempt', j.drop?.city, reason);
  };
  const primary = PRIMARY[j.status];
  const done = ['delivered', 'cancelled', 'returned_to_vendor'].includes(j.status);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <p className="text-sm"><Link href="/" className="text-ink-mute hover:text-ink">← Jobs</Link></p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{j.trackingNumber}</p>
          <h1 className="mt-1 font-display text-3xl">{j.orderNumber}</h1>
        </div>
        <Status status={j.status} />
      </div>

      {j.payment === 'cod' && !done && (
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">Cash on delivery: collect <b>{inr(j.codAmount)}</b> before handing over.</div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="card p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">1 · Pick up</p>
          <Address a={j.pickup} />
        </div>
        <div className="card p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">2 · Deliver to</p>
          <Address a={j.drop} />
          {j.customer?.phone && <a href={`tel:${j.customer.phone}`} className="mt-2 inline-block text-sm font-semibold text-clay underline">Call {j.customer.name.split(' ')[0]}</a>}
        </div>
      </div>

      <div className="card p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">Package · {j.units} item{j.units === 1 ? '' : 's'} from {j.seller}</p>
        <ul className="space-y-2">
          {j.items.map((i, k) => (
            <li key={k} className="flex items-center gap-3"><Thumb src={i.image} /><span className="text-sm">{i.name}<span className="block text-xs text-ink-mute">{i.color} · {i.size} · × {i.quantity}</span></span></li>
          ))}
        </ul>
      </div>

      {!done && (
        <div className="card space-y-3 p-4">
          {primary && (
            <button className="btn-primary w-full py-4 text-base" onClick={() => step(primary.to, primary.place?.(j))} disabled={!!busy}>
              {busy === primary.to && <Spinner />} {primary.label}
            </button>
          )}
          {j.status === 'out_for_delivery' && (
            <form onSubmit={deliver} className="space-y-3">
              <label className="label" htmlFor="otp">Customer’s delivery OTP</label>
              <input
                id="otp"
                className="input text-center font-mono text-2xl tracking-[0.5em]"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="••••••"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
              />
              <p className="text-xs text-ink-mute">The customer sees this 6-digit code on their order page and in their notifications.</p>
              <button className="btn w-full bg-leaf py-4 text-base text-white hover:bg-leaf/90" disabled={!!busy || otp.length !== 6}>{busy === 'deliver' && <Spinner />} Confirm delivery</button>
            </form>
          )}
          {j.status === 'out_for_delivery' && (
            <button onClick={fail} className="w-full text-sm font-semibold text-clay underline" disabled={!!busy}>Couldn’t deliver</button>
          )}
        </div>
      )}
      {j.status === 'delivered' && <div className="rounded-2xl bg-leaf-tint p-5 text-leaf"><p className="font-display text-2xl text-ink">Delivered</p><p className="text-sm">{j.deliveredAt && date(j.deliveredAt, true)} · you earned {inr(j.payout)}</p></div>}

      <div className="card p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">Timeline</p>
        <ol className="space-y-3 border-l border-paper-line pl-4">
          {[...j.events].reverse().map((e, k) => (
            <li key={k} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-ink" />
              <p className="text-sm font-medium">{e.description ?? e.status}</p>
              <p className="text-xs text-ink-mute">{date(e.at, true)}{e.location ? ` · ${e.location}` : ''}</p>
            </li>
          ))}
        </ol>
      </div>
      {j.attempts > 0 && <Badge tone="warn">{j.attempts} failed attempt{j.attempts === 1 ? '' : 's'}</Badge>}
    </div>
  );
}

export default function Page() {
  return <Gate><JobView /></Gate>;
}
