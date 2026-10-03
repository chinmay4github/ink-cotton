'use client';

import useSWR from 'swr';
import { Empty, Spinner, Status } from '@ic/ui/components';

export interface Rider {
  id: number; name: string; phone: string | null; email: string | null; status: 'pending' | 'approved' | 'rejected' | 'suspended';
  isAvailable: boolean; vehicleType: string | null; vehicleNumber: string | null; pincodes: string[]; rating: number; lat: number | null; lng: number | null;
}
export interface Job {
  id: number; trackingNumber: string; status: string; orderNumber: string; payment: 'cod' | 'prepaid'; codAmount: number;
  packedAt: string | null; assignedAt: string | null; deliveredAt: string | null; attempts: number; pickup: any; drop: any;
  customer: { name: string; phone: string | null } | null; seller: string; units: number; payout: number; next: string[];
  items: { name: string; color: string; size: string; image: string | null; quantity: number }[];
  events: { status: string; description: string | null; location: string | null; at: string }[];
}

export const useRider = () => useSWR<Rider>('/rider/me');

export function Gate({ children }: { children: React.ReactNode }) {
  const { data: r } = useRider();
  if (!r) return <div className="grid h-64 place-items-center"><Spinner className="text-ink-mute" /></div>;
  if (r.status === 'approved') return <>{children}</>;
  const copy = {
    pending: ['Application in review', 'We’re checking your documents. Once approved you can go online and start taking deliveries.'],
    rejected: ['Application not approved', 'Please contact rider support for details.'],
    suspended: ['Account suspended', 'Please contact rider support.'],
  }[r.status];
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3"><Status status={r.status} /><span className="text-sm text-ink-mute">{r.name}</span></div>
      <Empty title={copy[0]} body={copy[1]} />
    </div>
  );
}

/** Rider's position: the device GPS when allowed, otherwise a point near the Bengaluru hub (demo). */
export function currentPosition(): Promise<{ lat: number; lng: number }> {
  const fallback = () => ({ lat: +(12.9116 + (Math.random() - 0.5) * 0.04).toFixed(6), lng: +(77.6389 + (Math.random() - 0.5) * 0.04).toFixed(6) });
  const gps = new Promise<{ lat: number; lng: number }>((resolve) => {
    if (!('geolocation' in navigator)) return resolve(fallback());
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }),
      () => resolve(fallback()),
      { timeout: 4000, maximumAge: 60_000 },
    );
  });
  // never block a status update on a pending permission prompt
  return Promise.race([gps, new Promise<{ lat: number; lng: number }>((r) => setTimeout(() => r(fallback()), 2500))]);
}

export const STEP_LABEL: Record<string, string> = {
  picked_up: 'Picked up from seller',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  failed_attempt: 'Delivery attempt failed',
};
