'use client';

import useSWR from 'swr';
import { Empty, Spinner, Status } from '@ic/ui/components';

export interface Seller {
  id: number; status: 'pending' | 'approved' | 'rejected' | 'suspended'; businessName: string; displayName: string; slug: string;
  gstin: string | null; commissionPct: number; rating: number; rejectionReason: string | null; createdAt: string;
  pickup: { line1: string; city: string; state: string; postalCode: string } | null;
}

export const useSeller = () => useSWR<Seller>('/seller/me');

/** Pages that need an approved seller render this instead until the admin team approves the account. */
export function Gate({ children }: { children: React.ReactNode }) {
  const { data: s } = useSeller();
  if (!s) return <div className="grid h-64 place-items-center"><Spinner className="text-ink-mute" /></div>;
  if (s.status === 'approved') return <>{children}</>;
  const copy = {
    pending: ['Your application is in review', 'Our team usually reviews new sellers within one working day. You’ll get a notification here as soon as you’re approved.'],
    rejected: ['Application not approved', s.rejectionReason ?? 'Please contact seller support for details.'],
    suspended: ['Your account is suspended', s.rejectionReason ?? 'Your listings are hidden. Please contact seller support.'],
  }[s.status];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><Status status={s.status} /><span className="text-sm text-ink-mute">{s.displayName}</span></div>
      <Empty title={copy[0]} body={copy[1]} />
    </div>
  );
}
