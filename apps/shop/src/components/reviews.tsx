'use client';

import clsx from 'clsx';
import { useState } from 'react';
import useSWR from 'swr';
import { api, ApiError } from '@/lib/api';
import { date } from '@/lib/format';
import type { Paged, ProductDetail, Review } from '@/lib/types';
import { CheckIcon, StarIcon } from './icons';
import { useAuth, useToast } from './providers';
import { Stars } from './ui';

export function Reviews({ p }: { p: ProductDetail }) {
  const { user } = useAuth();
  const toast = useToast();
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const { data, mutate } = useSWR<Paged<Review>>(`/products/${p.slug}/reviews?sort=${sort}&limit=${page * 6}`);
  const { data: elig, mutate: mutateElig } = useSWR<{ canReview: boolean; existing: any }>(user?.role === 'customer' ? `/products/${p.slug}/reviews/eligibility` : null);
  const [writing, setWriting] = useState(false);
  const [form, setForm] = useState({ rating: 0, title: '', body: '', sizeFit: 'true_to_size' });
  const total = p.ratingDistribution.reduce((s, r) => s + r.count, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.rating) return toast('Pick a star rating', 'err');
    try {
      await api(`/products/${p.slug}/reviews`, { method: 'POST', json: form });
      toast('Thanks for your review!');
      setWriting(false);
      mutate();
      mutateElig();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not post review', 'err');
    }
  };

  return (
    <section id="reviews" className="mt-20 scroll-mt-32 border-t border-paper-line pt-12">
      <div className="grid gap-10 lg:grid-cols-[300px_1fr]">
        <div>
          <h2 className="font-display text-3xl">Reviews</h2>
          {total > 0 ? (
            <>
              <div className="mt-4 flex items-end gap-3">
                <span className="font-display text-5xl">{p.rating.toFixed(1)}</span>
                <div className="pb-1"><Stars value={p.rating} size={16} /><p className="text-xs text-ink-mute">{total} ratings</p></div>
              </div>
              <div className="mt-5 space-y-1.5">
                {p.ratingDistribution.map((r) => (
                  <div key={r.rating} className="flex items-center gap-2 text-xs">
                    <span className="w-3">{r.rating}</span><StarIcon size={11} className="text-gold" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-warm"><div className="h-full rounded-full bg-ink" style={{ width: `${(r.count / total) * 100}%` }} /></div>
                    <span className="w-6 text-right text-ink-mute">{r.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-ink-mute">No reviews yet.</p>
          )}
          {elig?.canReview && !writing && (
            <button onClick={() => { setWriting(true); if (elig.existing) setForm({ rating: elig.existing.rating, title: elig.existing.title ?? '', body: elig.existing.body ?? '', sizeFit: elig.existing.size_fit ?? 'true_to_size' }); }} className="btn-outline mt-6 w-full">
              {elig.existing ? 'Edit your review' : 'Write a review'}
            </button>
          )}
          {user && elig && !elig.canReview && <p className="mt-6 text-xs text-ink-mute">You can review this after it’s delivered to you.</p>}
        </div>

        <div>
          {writing && (
            <form onSubmit={submit} className="card mb-8 space-y-4 p-6">
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <button type="button" key={i} onClick={() => setForm({ ...form, rating: i })} aria-label={`${i} stars`}>
                    <StarIcon size={28} filled={form.rating >= i} className={form.rating >= i ? 'text-gold' : 'text-paper-line'} />
                  </button>
                ))}
              </div>
              <input className="input" placeholder="Headline" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} maxLength={150} />
              <textarea className="input min-h-28" placeholder="How was the fabric, fit and colour?" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} maxLength={2000} />
              <div className="flex flex-wrap gap-2">
                {[['runs_small', 'Runs small'], ['true_to_size', 'True to size'], ['runs_large', 'Runs large']].map(([v, l]) => (
                  <button type="button" key={v} onClick={() => setForm({ ...form, sizeFit: v })} className={clsx('chip', form.sizeFit === v && 'border-ink bg-ink text-white')}>{l}</button>
                ))}
              </div>
              <div className="flex gap-3"><button className="btn-primary">Submit review</button><button type="button" className="btn-ghost" onClick={() => setWriting(false)}>Cancel</button></div>
            </form>
          )}

          {!!data?.items.length && (
            <div className="mb-4 flex justify-end">
              <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="rounded-full border border-paper-line bg-white px-4 py-2 text-sm">
                <option value="recent">Most recent</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option>
              </select>
            </div>
          )}
          <ul className="divide-y divide-paper-line">
            {data?.items.map((r) => (
              <li key={r.id} className="py-6">
                <div className="flex items-center gap-3"><Stars value={r.rating} />{r.title && <p className="text-sm font-semibold">{r.title}</p>}</div>
                {r.body && <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.body}</p>}
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-mute">
                  <span className="font-medium text-ink">{r.author}</span>
                  {r.verified && <span className="inline-flex items-center gap-1 text-leaf"><CheckIcon size={12} /> Verified buyer</span>}
                  {r.purchased && <span>Bought: {r.purchased}</span>}
                  {r.sizeFit && <span className="capitalize">{r.sizeFit.replace(/_/g, ' ')}</span>}
                  <span>{date(r.createdAt)}</span>
                </p>
              </li>
            ))}
          </ul>
          {data && data.total > data.items.length && (
            <button onClick={() => setPage(page + 1)} className="btn-outline mt-4">Show more reviews</button>
          )}
        </div>
      </div>
    </section>
  );
}
