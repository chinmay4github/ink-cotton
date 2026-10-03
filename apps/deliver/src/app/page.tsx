'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { api } from '@ic/ui/api';
import { Address, Badge, Empty, ReturnCard, type ReturnRow, Spinner, Status } from '@ic/ui/components';
import { inr, relative } from '@ic/ui/format';
import { useAction } from '@ic/ui/staff';
import { Gate, type Job, useRider } from '@/lib/rider';

function JobCard({ j, action }: { j: Job; action?: React.ReactNode }) {
  return (
    <article className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{j.seller} → {j.drop?.city} {j.drop?.postalCode}</p>
          <p className="text-xs text-ink-mute">{j.orderNumber} · {j.units} item{j.units === 1 ? '' : 's'}{j.packedAt ? ` · packed ${relative(j.packedAt)}` : ''}</p>
        </div>
        {j.payment === 'cod' ? <Badge tone="warn">Collect {inr(j.codAmount)}</Badge> : <Badge tone="good">Prepaid</Badge>}
      </div>
      <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
        {j.items.map((i, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={k} src={i.image ?? ''} alt={i.name} className="h-14 w-11 shrink-0 rounded-lg bg-paper-warm object-cover" />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-xl bg-paper-warm p-3"><p className="mb-1 font-semibold uppercase tracking-[0.12em] text-ink-mute">Pickup</p><Address a={j.pickup} compact /></div>
        <div className="rounded-xl bg-paper-warm p-3"><p className="mb-1 font-semibold uppercase tracking-[0.12em] text-ink-mute">Drop</p><Address a={j.drop} compact /></div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm">You earn <b>{inr(j.payout)}</b></p>
        {action}
      </div>
    </article>
  );
}

function Home() {
  const router = useRouter();
  const { data: me, mutate: mutateMe } = useRider();
  const online = !!me?.isAvailable;
  const { data: mine, mutate: mutateMine } = useSWR<Job[]>('/rider/jobs?scope=active', { refreshInterval: 15_000 });
  const { data: open, mutate: mutateOpen } = useSWR<Job[]>(online ? '/rider/jobs/available' : null, { refreshInterval: 10_000 });
  const { data: pickups, mutate: mutatePickups } = useSWR<ReturnRow[]>(online ? '/rider/returns/available' : null, { refreshInterval: 15_000 });
  const { data: myPickups, mutate: mutateMyPickups } = useSWR<ReturnRow[]>('/rider/returns', { refreshInterval: 15_000 });
  const { busy, run } = useAction();

  const toggle = () =>
    run('online', async () => {
      await api('/rider/me', { method: 'PATCH', json: { isAvailable: !online } });
      await mutateMe();
    }, online ? 'You’re offline' : 'You’re online. New jobs will show up here.');
  const claim = (j: Job) =>
    run(`c${j.id}`, async () => {
      await api(`/rider/jobs/${j.id}/claim`, { method: 'POST' });
      await Promise.all([mutateMine(), mutateOpen()]);
      router.push(`/jobs/${j.id}`);
    }, 'Job accepted');
  const claimReturn = (r: ReturnRow) =>
    run(`r${r.id}`, async () => {
      await api(`/rider/returns/${r.id}/claim`, { method: 'POST' });
      await Promise.all([mutatePickups(), mutateMyPickups()]);
    }, 'Return pickup accepted');
  const pickedUp = (r: ReturnRow) =>
    run(`p${r.id}`, async () => {
      await api(`/rider/returns/${r.id}/picked-up`, { method: 'POST' });
      await mutateMyPickups();
    }, 'Marked picked up. Drop it at the seller’s address.');

  const activePickups = myPickups?.filter((r) => r.status === 'approved' || r.status === 'picked_up') ?? [];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <section className={clsx('flex items-center justify-between gap-4 rounded-3xl p-5', online ? 'bg-leaf text-white' : 'bg-white ring-1 ring-paper-line')}>
        <div>
          <p className="font-display text-2xl">{online ? 'You’re online' : 'You’re offline'}</p>
          <p className={clsx('text-sm', online ? 'text-white/80' : 'text-ink-mute')}>{online ? 'Accept jobs below. Go offline when you’re done.' : 'Go online to see delivery jobs near you.'}</p>
        </div>
        <button onClick={toggle} disabled={!!busy} role="switch" aria-checked={online} className={clsx('relative h-9 w-16 shrink-0 rounded-full transition', online ? 'bg-white/30' : 'bg-paper-line')}>
          <span className={clsx('absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all', online ? 'left-8' : 'left-1')} />
          <span className="sr-only">{online ? 'Go offline' : 'Go online'}</span>
        </button>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em]">Your active deliveries</h2>
        {!mine && <div className="skeleton h-32" />}
        {mine?.length === 0 && <p className="rounded-2xl border border-dashed border-paper-line p-5 text-sm text-ink-mute">No active deliveries.</p>}
        <div className="space-y-3">
          {mine?.map((j) => (
            <JobCard key={j.id} j={j} action={<span className="flex items-center gap-2"><Status status={j.status} /><Link href={`/jobs/${j.id}`} className="btn-primary px-4 py-2">Open</Link></span>} />
          ))}
        </div>
      </section>

      {activePickups.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em]">Your return pickups</h2>
          <div className="space-y-3">
            {activePickups.map((r) => (
              <ReturnCard
                key={r.id}
                r={r}
                showAddresses="both"
                actions={r.status === 'approved' ? (
                  <button className="btn-primary px-4 py-2" onClick={() => pickedUp(r)} disabled={!!busy}>{busy === `p${r.id}` && <Spinner />} Picked up from customer</button>
                ) : <span className="text-xs text-ink-mute">Hand it to {r.seller}. They confirm receipt.</span>}
              />
            ))}
          </div>
        </section>
      )}

      {online && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.14em]">New jobs near you</h2>
          {!open && <div className="skeleton h-32" />}
          {open?.length === 0 && pickups?.length === 0 && <Empty title="No jobs right now" body="Packed orders appear here the moment a seller marks them ready. This list refreshes on its own." />}
          <div className="space-y-3">
            {open?.map((j) => (
              <JobCard key={j.id} j={j} action={<button className="btn-primary px-4 py-2" onClick={() => claim(j)} disabled={!!busy}>{busy === `c${j.id}` && <Spinner />} Accept</button>} />
            ))}
            {pickups?.map((r) => (
              <ReturnCard key={r.id} r={r} showAddresses="pickup" actions={<button className="btn-outline px-4 py-2" onClick={() => claimReturn(r)} disabled={!!busy}>{busy === `r${r.id}` && <Spinner />} Accept return pickup · ₹30</button>} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function Page() {
  return <Gate><Home /></Gate>;
}
