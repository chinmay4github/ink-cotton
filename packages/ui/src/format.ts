const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrFmt2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const inr = (v: number, exact = false) => (exact && v % 1 !== 0 ? inrFmt2 : inrFmt).format(v);

export const date = (d: string | Date, withTime = false) =>
  new Date(d).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: withTime ? undefined : 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });

export const relative = (d: string | Date) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return date(d);
};

export const ORDER_STATUS: Record<string, { label: string; tone: 'neutral' | 'good' | 'warn' | 'bad' | 'info' }> = {
  pending: { label: 'Awaiting payment', tone: 'warn' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  processing: { label: 'Processing', tone: 'info' },
  partially_shipped: { label: 'Partially shipped', tone: 'info' },
  shipped: { label: 'Shipped', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'good' },
  cancelled: { label: 'Cancelled', tone: 'bad' },
  returned: { label: 'Returned', tone: 'neutral' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};

export const deptLabel = (d: string) => ({ men: 'Men', women: 'Women', kids: 'Kids' })[d] ?? d;
