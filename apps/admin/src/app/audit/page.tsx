'use client';

import useSWR from 'swr';
import { Empty, PageHeader } from '@ic/ui/components';
import { date } from '@ic/ui/format';

interface Entry { id: number; admin: string; action: string; entity: string; entityId: number; values: Record<string, unknown>; at: string }

export default function Page() {
  const { data } = useSWR<Entry[]>('/admin/audit', { refreshInterval: 30_000 });
  return (
    <>
      <PageHeader title="Audit log" eyebrow="Every admin action, newest first" />
      {!data && <div className="skeleton h-40" />}
      {data?.length === 0 && <Empty title="No admin actions yet" />}
      {data && data.length > 0 && (
        <ul className="card divide-y divide-paper-line">
          {data.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <span><b className="font-mono text-xs">{e.action}</b> <span className="text-ink-soft">{e.entity} #{e.entityId}</span>{e.values && Object.keys(e.values).length > 0 && <span className="ml-2 text-xs text-ink-mute">{JSON.stringify(e.values)}</span>}</span>
              <span className="text-xs text-ink-mute">{e.admin} · {date(e.at, true)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
