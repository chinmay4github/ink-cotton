'use client';

import { useEffect, useState } from 'react';
import { api } from '@ic/ui/api';
import { PageHeader, Spinner, Status } from '@ic/ui/components';
import { useAction } from '@ic/ui/staff';
import { currentPosition, useRider } from '@/lib/rider';

export default function Profile() {
  const { data: r, mutate } = useRider();
  const { busy, run } = useAction();
  const [f, setF] = useState({ vehicleType: 'bike', vehicleNumber: '', pincodes: '' });
  useEffect(() => {
    if (r) setF({ vehicleType: r.vehicleType ?? 'bike', vehicleNumber: r.vehicleNumber ?? '', pincodes: r.pincodes.join(', ') });
  }, [r]);
  if (!r) return <div className="skeleton h-64" />;
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    run('save', async () => {
      await api('/rider/me', { method: 'PATCH', json: { vehicleType: f.vehicleType, vehicleNumber: f.vehicleNumber, pincodes: f.pincodes.split(/[\s,]+/).filter(Boolean) } });
      await mutate();
    }, 'Profile saved');
  };
  const locate = () =>
    run('loc', async () => {
      await api('/rider/location', { method: 'POST', json: await currentPosition() });
      await mutate();
    }, 'Location shared');
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={r.name} eyebrow="Profile"><div className="mt-2 flex items-center gap-2"><Status status={r.status} /><span className="text-sm text-ink-mute">★ {r.rating.toFixed(1)} · {r.phone}</span></div></PageHeader>
      <form onSubmit={save} className="card space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="vt">Vehicle</label>
            <select id="vt" className="input" value={f.vehicleType} onChange={(e) => setF({ ...f, vehicleType: e.target.value })}>
              {['bike', 'scooter', 'cycle', 'van', 'truck'].map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="vn">Vehicle number</label><input id="vn" className="input uppercase" value={f.vehicleNumber} onChange={(e) => setF({ ...f, vehicleNumber: e.target.value })} /></div>
        </div>
        <div><label className="label" htmlFor="pc">PIN codes you cover</label><input id="pc" className="input" value={f.pincodes} onChange={(e) => setF({ ...f, pincodes: e.target.value })} /></div>
        <button className="btn-primary" disabled={!!busy}>{busy === 'save' && <Spinner />} Save</button>
      </form>
      <div className="card mt-4 flex items-center justify-between gap-4 p-6">
        <div>
          <p className="text-sm font-semibold">Live location</p>
          <p className="text-xs text-ink-mute">{r.lat != null ? `Last shared ${r.lat.toFixed(4)}, ${r.lng?.toFixed(4)}` : 'Not shared yet'} · customers see it while you deliver</p>
        </div>
        <button className="btn-outline" onClick={locate} disabled={!!busy}>{busy === 'loc' && <Spinner />} Share now</button>
      </div>
    </div>
  );
}
