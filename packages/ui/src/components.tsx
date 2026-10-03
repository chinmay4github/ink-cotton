import clsx from 'clsx';
import { inr } from './format';

export type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'accent';

const TONE: Record<Tone, string> = {
  good: 'bg-leaf-tint text-leaf',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-clay-tint text-clay-dark',
  info: 'bg-sky-50 text-sky-800',
  neutral: 'bg-paper-warm text-ink-soft',
  accent: 'bg-ink text-white',
};

/** One vocabulary for every status in the platform, so sellers, riders and admins read them the same way. */
const STATUS: Record<string, [string, Tone]> = {
  // orders
  pending: ['Awaiting payment', 'warn'],
  confirmed: ['Confirmed', 'info'],
  processing: ['Processing', 'info'],
  partially_shipped: ['Partly shipped', 'info'],
  shipped: ['Shipped', 'info'],
  delivered: ['Delivered', 'good'],
  cancelled: ['Cancelled', 'bad'],
  returned: ['Returned', 'neutral'],
  refunded: ['Refunded', 'neutral'],
  // shipments
  created: ['To pack', 'warn'],
  assigned: ['Rider assigned', 'info'],
  picked_up: ['Picked up', 'info'],
  in_transit: ['In transit', 'info'],
  out_for_delivery: ['Out for delivery', 'accent'],
  failed_attempt: ['Attempt failed', 'bad'],
  returned_to_vendor: ['Returned to seller', 'neutral'],
  // accounts & products
  approved: ['Approved', 'good'],
  rejected: ['Rejected', 'bad'],
  suspended: ['Suspended', 'bad'],
  active: ['Live', 'good'],
  inactive: ['Hidden', 'neutral'],
  draft: ['Draft', 'neutral'],
  pending_approval: ['In review', 'warn'],
  // returns
  requested: ['Requested', 'warn'],
  completed: ['Refunded', 'good'],
  // payouts
  paid: ['Paid', 'good'],
  failed: ['Failed', 'bad'],
};

export function Status({ status, label }: { status: string; label?: string }) {
  const [text, tone] = STATUS[status] ?? [status.replace(/_/g, ' '), 'neutral' as Tone];
  return <span className={clsx('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold capitalize', TONE[tone])}>{label ?? text}</span>;
}

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', TONE[tone], className)}>{children}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} aria-label="Loading" />;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-paper-warm font-display text-2xl italic text-clay">&amp;</div>
      <h2 className="font-display text-2xl">{title}</h2>
      {body && <p className="mt-2 max-w-sm text-sm text-ink-mute">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Money({ value, mrp, className }: { value: number; mrp?: number; className?: string }) {
  const off = mrp && mrp > value ? Math.round(((mrp - value) / mrp) * 100) : 0;
  return (
    <span className={clsx('inline-flex flex-wrap items-baseline gap-x-1.5', className)}>
      <span className="font-semibold">{inr(value)}</span>
      {off > 0 && <><span className="text-xs text-ink-mute line-through">{inr(mrp!)}</span><span className="text-xs font-semibold text-clay">{off}% off</span></>}
    </span>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'warn' | 'good' }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-mute">{label}</p>
      <p className={clsx('mt-2 font-display text-3xl leading-none', tone === 'warn' && 'text-clay', tone === 'good' && 'text-leaf')}>{value}</p>
      {hint && <p className="mt-2 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

export function Thumb({ src, alt = '', className }: { src?: string | null; alt?: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return src ? <img src={src} alt={alt} className={clsx('rounded-lg bg-paper-warm object-cover', className ?? 'h-14 w-11')} loading="lazy" /> : <div className={clsx('rounded-lg bg-paper-warm', className ?? 'h-14 w-11')} />;
}

export function Address({ a, compact }: { a: any; compact?: boolean }) {
  if (!a) return null;
  const lines = [a.line1, a.line2, a.landmark].filter(Boolean).join(', ');
  return (
    <div className="text-sm leading-relaxed text-ink-soft">
      {a.name && <p className="font-semibold text-ink">{a.name}</p>}
      {!compact && lines && <p>{lines}</p>}
      <p>{[a.city, a.state].filter(Boolean).join(', ')} {a.postalCode}</p>
      {!compact && a.phone && <p>{a.phone}</p>}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-paper-line" role="tablist">
      {items.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={clsx('-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition', value === t.value ? 'border-ink text-ink' : 'border-transparent text-ink-mute hover:text-ink')}
        >
          {t.label}
          {t.count != null && t.count > 0 && <span className={clsx('rounded-full px-1.5 text-[11px] font-semibold', value === t.value ? 'bg-ink text-white' : 'bg-paper-warm text-ink-soft')}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, eyebrow, actions, children }: { title: string; eyebrow?: string; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ returns (shared by sell / deliver / admin)
export interface ReturnRow {
  id: number; status: string; reason: string; reasonLabel: string; comments: string | null; createdAt: string; updatedAt: string;
  pickedUpAt: string | null; refundAmount: number | null; orderNumber: string; customer: { name: string; phone: string | null };
  pickupFrom: any; dropTo: any; seller: string; rider: { id: number; name: string; phone: string | null } | null;
  item: { id: number; name: string; sku: string; color: string; size: string; image: string | null; quantity: number; total: number };
}

const RETURN_STEPS = ['requested', 'approved', 'picked_up', 'completed'];

export function ReturnCard({ r, actions, showAddresses }: { r: ReturnRow; actions?: React.ReactNode; showAddresses?: 'pickup' | 'both' }) {
  const step = RETURN_STEPS.indexOf(r.status);
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Thumb src={r.item.image} />
          <div>
            <p className="text-sm font-semibold">{r.item.name}</p>
            <p className="text-xs text-ink-mute">{r.item.color} · {r.item.size} · {r.orderNumber} · {inr(r.item.total)}</p>
            <p className="mt-1 text-xs"><b>{r.reasonLabel}</b>{r.comments ? ` · “${r.comments}”` : ''}</p>
          </div>
        </div>
        <Status status={r.status} label={r.status === 'approved' ? (r.rider ? `Pickup by ${r.rider.name}` : 'Awaiting pickup') : undefined} />
      </div>
      {r.status !== 'rejected' && (
        <ol className="mt-4 grid grid-cols-4 gap-1 text-[11px] text-ink-mute">
          {['Requested', 'Approved', 'Picked up', 'Refunded'].map((l, i) => (
            <li key={l}>
              <span className={clsx('block h-1 rounded-full', i <= step ? 'bg-leaf' : 'bg-paper-line')} />
              <span className={clsx('mt-1 block', i <= step && 'font-semibold text-ink')}>{l}</span>
            </li>
          ))}
        </ol>
      )}
      {showAddresses && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-paper-warm p-3"><p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">Pick up from</p><Address a={r.pickupFrom} compact={showAddresses === 'pickup' && !r.rider} /></div>
          {showAddresses === 'both' && <div className="rounded-xl bg-paper-warm p-3"><p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-mute">Return to</p><Address a={r.dropTo} /></div>}
        </div>
      )}
      {(actions || r.refundAmount) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-paper-line pt-4">
          <p className="text-xs text-ink-mute">{r.refundAmount ? <>Refunded <b className="text-leaf">{inr(r.refundAmount)}</b></> : `Customer: ${r.customer.name}`}</p>
          <div className="flex gap-2">{actions}</div>
        </div>
      )}
    </article>
  );
}
