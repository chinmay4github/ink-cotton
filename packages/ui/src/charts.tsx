'use client';

import clsx from 'clsx';
import { useState } from 'react';

/**
 * Single-series column chart for daily figures (orders, revenue, earnings).
 * One series → no legend; the title names it. Hover/focus shows a tooltip; "Table" shows the numbers.
 * Bar colour is the brand clay (validated: lightness band, chroma and 3:1 contrast on the light surface).
 */
export function DailyBars({
  title, data, format = (v) => String(v), height = 180,
}: { title: string; data: { date: string; value: number }[]; format?: (v: number) => string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = niceMax(max);
  const label = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <figure className="card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <figcaption>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-ink-mute">Last {data.length} days · total {format(total)}</p>
        </figcaption>
        <button onClick={() => setTable((t) => !t)} className="rounded-full border border-paper-line px-3 py-1 text-xs font-medium text-ink-soft hover:border-ink">
          {table ? 'Chart' : 'Table'}
        </button>
      </div>
      {table ? (
        <div className="max-h-[220px] overflow-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-ink-mute"><th className="py-1 font-medium">Day</th><th className="py-1 text-right font-medium">{title}</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.date} className="border-t border-paper-line"><td className="py-1.5">{label(d.date)}</td><td className="py-1.5 text-right tabular-nums">{format(d.value)}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="relative mt-6" style={{ height }}>
          {/* gridlines: recessive */}
          {[0, 0.5, 1].map((f) => (
            <div key={f} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${f * 100}%` }}>
              <span className="w-12 shrink-0 -translate-y-1/2 text-right text-[10px] tabular-nums text-ink-mute">{format(nice * f)}</span>
              <span className="h-px flex-1 bg-paper-line" />
            </div>
          ))}
          <div className="absolute inset-y-0 left-14 right-0 flex items-end gap-[2px]">
            {data.map((d, i) => (
              <button
                key={d.date}
                className="group relative flex h-full flex-1 items-end focus:outline-none"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${label(d.date)}: ${format(d.value)}`}
              >
                <span
                  className={clsx('w-full rounded-t-[4px] transition-opacity', hover != null && hover !== i && 'opacity-50')}
                  style={{ height: `${(d.value / nice) * 100}%`, minHeight: d.value ? 2 : 0, background: '#A8482A' }}
                />
                {hover === i && (
                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs text-white shadow-card">
                    <span className="block text-white/70">{label(d.date)}</span>
                    <b className="tabular-nums">{format(d.value)}</b>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
      {!table && (
        <div className="ml-14 mt-2 flex justify-between text-[10px] text-ink-mute">
          <span>{label(data[0]?.date ?? '')}</span>
          <span>{label(data[data.length - 1]?.date ?? '')}</span>
        </div>
      )}
    </figure>
  );
}

function niceMax(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/** Horizontal ranked bars (top products). Values are direct-labelled. */
export function RankBars({ title, rows, format = (v) => String(v) }: { title: string; rows: { label: string; value: number; note?: string }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="card p-5">
      <p className="mb-4 text-sm font-semibold">{title}</p>
      {rows.length === 0 && <p className="text-sm text-ink-mute">No sales yet.</p>}
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex justify-between gap-3 text-sm">
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">{format(r.value)}</span>
            </div>
            <div className="mt-1 h-2 rounded-full bg-paper-warm">
              <div className="h-2 rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: '#A8482A' }} />
            </div>
            {r.note && <p className="mt-0.5 text-xs text-ink-mute">{r.note}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
