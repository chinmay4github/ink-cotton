'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { ShieldIcon } from '@/components/icons';
import { Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';
import type { OrderDetail } from '@/lib/types';

/**
 * Stand-in for the payment gateway's hosted checkout (Razorpay/Stripe sheet).
 * In production the gateway SDK opens here and its callback posts the signature to /orders/:no/pay.
 */
export default function PayPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const router = useRouter();
  const { data: o } = useSWR<OrderDetail>(`/orders/${orderNumber}`);
  const [busy, setBusy] = useState<string | null>(null);

  const pay = async (simulate: 'success' | 'failure') => {
    setBusy(simulate);
    await api(`/orders/${orderNumber}/pay`, { method: 'POST', json: { simulate } }).catch(() => null);
    router.replace(`/orders/${orderNumber}?placed=1`);
  };

  if (!o) return <div className="container-page py-16"><div className="skeleton mx-auto h-80 max-w-md" /></div>;
  if (!o.canPay) {
    router.replace(`/orders/${orderNumber}`);
    return null;
  }
  return (
    <div className="container-page py-16">
      <div className="card mx-auto max-w-md overflow-hidden">
        <div className="bg-ink px-6 py-5 text-white">
          <p className="text-xs uppercase tracking-[0.16em] text-white/60">Test payment gateway</p>
          <p className="mt-1 text-2xl font-semibold">{inr(o.amounts.total, true)}</p>
          <p className="text-xs text-white/60">Order {o.orderNumber} · {o.paymentMethod.toUpperCase()}</p>
        </div>
        <div className="space-y-3 p-6">
          <p className="text-sm text-ink-soft">This is a sandbox. Choose an outcome to see how the store handles it. Stock is held for 30 minutes while payment is pending.</p>
          <button onClick={() => pay('success')} disabled={!!busy} className="btn-accent w-full py-4">{busy === 'success' && <Spinner />} Pay successfully</button>
          <button onClick={() => pay('failure')} disabled={!!busy} className="btn-outline w-full">{busy === 'failure' && <Spinner />} Simulate a failed payment</button>
          <p className="flex items-center justify-center gap-1.5 pt-2 text-xs text-ink-mute"><ShieldIcon size={14} /> Payments are verified server-side</p>
        </div>
      </div>
    </div>
  );
}
