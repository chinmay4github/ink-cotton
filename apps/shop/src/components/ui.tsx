import clsx from 'clsx';
import { inr, ORDER_STATUS } from '@/lib/format';
import { StarIcon } from './icons';

export function Price({ price, mrp, size = 'md' }: { price: number; mrp?: number; size?: 'sm' | 'md' | 'lg' }) {
  const off = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return (
    <div className={clsx('flex flex-wrap items-baseline gap-x-2', size === 'lg' && 'gap-x-3')}>
      <span className={clsx('font-semibold text-ink', size === 'sm' && 'text-sm', size === 'lg' && 'text-2xl')}>{inr(price)}</span>
      {off > 0 && (
        <>
          <span className={clsx('text-ink-mute line-through', size === 'lg' ? 'text-base' : 'text-xs')}>{inr(mrp!)}</span>
          <span className={clsx('font-semibold text-clay', size === 'lg' ? 'text-base' : 'text-xs')}>{off}% off</span>
        </>
      )}
    </div>
  );
}

export function Stars({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={clsx('inline-flex text-gold', className)} aria-label={`${value.toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} size={size} filled={value >= i - 0.25} className={value >= i - 0.25 ? '' : 'text-paper-line'} />
      ))}
    </span>
  );
}

export function RatingPill({ value, count }: { value: number; count: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-semibold text-ink shadow-sm">
      {value.toFixed(1)} <StarIcon size={11} className="text-leaf" /> <span className="font-normal text-ink-mute">| {count}</span>
    </span>
  );
}

const TONE: Record<string, string> = {
  good: 'bg-leaf-tint text-leaf',
  warn: 'bg-amber-50 text-amber-800',
  bad: 'bg-clay-tint text-clay-dark',
  info: 'bg-sky-50 text-sky-800',
  neutral: 'bg-paper-warm text-ink-soft',
};

export function StatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] ?? { label: status.replace(/_/g, ' '), tone: 'neutral' as const };
  return <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize', TONE[s.tone])}>{s.label}</span>;
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx('inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent', className)} aria-label="Loading" />;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-paper-warm font-display text-2xl italic text-clay">&amp;</div>
      <h2 className="font-display text-2xl">{title}</h2>
      {body && <p className="mt-2 max-w-sm text-sm text-ink-mute">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
