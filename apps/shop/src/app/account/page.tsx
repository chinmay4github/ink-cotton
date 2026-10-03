'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { AddressForm, AddressText } from '@/components/address-form';
import { useAuth, useToast } from '@/components/providers';
import { Spinner } from '@/components/ui';
import { api, ApiError } from '@/lib/api';
import type { Address } from '@/lib/types';

type Pref = { type: string; channels: { channel: string; enabled: boolean }[] };

export default function AccountPage() {
  const { user, refresh, logout } = useAuth();
  const toast = useToast();
  const { data: addresses, mutate } = useSWR<Address[]>(user ? '/addresses' : null);
  const { data: prefs, mutate: mutatePrefs } = useSWR<Pref[]>(user ? '/notifications/preferences' : null);
  const [editing, setEditing] = useState<Address | 'new' | null>(null);
  const [profile, setProfile] = useState<{ fullName: string; phone: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) return <div className="container-page py-10"><div className="skeleton h-96" /></div>;

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api('/auth/me', { method: 'PATCH', json: { fullName: profile!.fullName, phone: profile!.phone || undefined } });
      refresh();
      setProfile(null);
      toast('Profile updated');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save', 'err');
    }
    setBusy(false);
  };

  return (
    <div className="container-page max-w-4xl space-y-8 py-10">
      <h1 className="font-display text-4xl">Account</h1>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em]">Profile</h2>
          {!profile && <button className="text-sm font-semibold underline" onClick={() => setProfile({ fullName: user.full_name, phone: user.phone ?? '' })}>Edit</button>}
        </div>
        {!profile ? (
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-ink-mute">Name</dt><dd className="font-medium">{user.full_name}</dd></div>
            <div><dt className="text-xs text-ink-mute">Email</dt><dd className="font-medium">{user.email}</dd></div>
            <div><dt className="text-xs text-ink-mute">Mobile</dt><dd className="font-medium">{user.phone ?? '—'}</dd></div>
          </dl>
        ) : (
          <form onSubmit={saveProfile} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} /></div>
            <div><label className="label">Mobile</label><input className="input" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
            <div className="flex gap-3"><button className="btn-primary" disabled={busy}>{busy && <Spinner />}Save</button><button type="button" className="btn-ghost" onClick={() => setProfile(null)}>Cancel</button></div>
          </form>
        )}
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em]">Saved addresses</h2>
          {!editing && <button className="text-sm font-semibold underline" onClick={() => setEditing('new')}>Add new</button>}
        </div>
        {editing && (
          <div className="mt-5">
            <AddressForm initial={editing === 'new' ? undefined : editing} onSaved={() => { mutate(); setEditing(null); toast('Address saved'); }} onCancel={() => setEditing(null)} />
          </div>
        )}
        {!editing && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {addresses?.map((a) => (
              <div key={a.id} className="rounded-2xl border border-paper-line p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded bg-paper-warm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">{a.type}</span>
                  {a.is_default && <span className="text-[10px] font-semibold uppercase text-leaf">Default</span>}
                </div>
                <AddressText a={a} />
                <div className="mt-3 flex gap-4 text-xs font-semibold">
                  <button className="underline" onClick={() => setEditing(a)}>Edit</button>
                  {!a.is_default && <button className="underline" onClick={async () => { await api(`/addresses/${a.id}`, { method: 'PATCH', json: { isDefault: true } }); mutate(); }}>Set default</button>}
                  <button className="text-clay underline" onClick={async () => { if (confirm('Delete this address?')) { await api(`/addresses/${a.id}`, { method: 'DELETE' }); mutate(); } }}>Delete</button>
                </div>
              </div>
            ))}
            {addresses && !addresses.length && <p className="text-sm text-ink-mute">No saved addresses yet.</p>}
          </div>
        )}
      </section>

      <section id="notifications" className="card scroll-mt-32 p-6">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em]">Notification preferences</h2>
        <p className="mt-1 text-sm text-ink-mute">In-app notifications are always on. Choose how else we reach you.</p>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-ink-mute"><th className="py-2 font-medium">Type</th>{['push', 'email', 'sms'].map((c) => <th key={c} className="py-2 text-center font-medium uppercase">{c}</th>)}</tr></thead>
            <tbody>
              {prefs?.map((p) => (
                <tr key={p.type} className="border-t border-paper-line">
                  <td className="py-3 capitalize">{p.type}</td>
                  {p.channels.map((c) => (
                    <td key={c.channel} className="py-3 text-center">
                      <input type="checkbox" className="h-4 w-4 accent-ink" checked={c.enabled}
                        onChange={async (e) => mutatePrefs(await api('/notifications/preferences', { method: 'PUT', json: { type: p.type, channel: c.channel, enabled: e.target.checked } }), false)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <button onClick={logout} className="btn-outline">Log out</button>
    </div>
  );
}
