import Link from 'next/link';
import { Promises } from '@/components/footer';
import { ChevronRight } from '@/components/icons';
import { ProductRail } from '@/components/product-card';
import { HERO, photo } from '@/lib/photos';
import { serverApi } from '@/lib/server-api';
import type { Paged, ProductCard } from '@/lib/types';

export const revalidate = 120;

const get = (qs: string) => serverApi<Paged<ProductCard>>(`/products?${qs}`, { revalidate: 120 });

function Section({ eyebrow, title, href, children }: { eyebrow: string; title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="container-page mt-20">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-2 font-display text-3xl sm:text-4xl">{title}</h2>
        </div>
        <Link href={href} className="hidden shrink-0 items-center gap-1 text-sm font-semibold hover:underline sm:inline-flex">View all <ChevronRight size={16} /></Link>
      </div>
      {children}
    </section>
  );
}

export default async function Home() {
  const [featured, fresh, women, kids] = await Promise.all([
    get('featured=true&limit=8'),
    get('sort=newest&limit=8'),
    get('category=women-ethnic&sort=rating&limit=4'),
    get('department=kids&sort=rating&limit=8'),
  ]);
  const depts = [
    { d: 'women', label: 'Women', line: 'Dresses, kurtas, sarees & denim', hero: HERO.women },
    { d: 'men', label: 'Men', line: 'Tees, shirts, jackets & chinos', hero: HERO.men },
    { d: 'kids', label: 'Kids', line: 'Play-ready cotton, 0–14 years', hero: HERO.kids },
  ];

  return (
    <>
      {/* hero */}
      <section className="relative isolate overflow-hidden bg-ink text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo(HERO.home.id, 2000, 1100)}
          alt={HERO.home.alt}
          className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_30%]"
          fetchPriority="high"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/35 to-transparent" />
        <div className="container-page flex min-h-[520px] flex-col justify-end py-14 sm:min-h-[600px] lg:py-20">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">The Autumn Edit · 2026</p>
            <h1 className="mt-4 font-display text-5xl leading-[1.05] sm:text-6xl lg:text-7xl">Made in cotton.<br />Made to last.</h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/85">
              Breathable essentials, handcrafted ethnic wear and kidswear built for play, from independent Indian makers.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/shop/women" className="btn bg-white text-ink hover:bg-paper">Shop Women</Link>
              <Link href="/shop/men" className="btn border border-white/60 text-white hover:bg-white/10">Shop Men</Link>
              <Link href="/shop/kids" className="btn border border-white/60 text-white hover:bg-white/10">Shop Kids</Link>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page mt-8"><Promises /></div>

      {/* departments */}
      <section className="container-page mt-16 grid gap-4 sm:grid-cols-3">
        {depts.map((d) => (
          <Link key={d.d} href={`/shop/${d.d}`} className="group relative isolate flex aspect-[3/4] overflow-hidden rounded-3xl bg-paper-warm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo(d.hero.id, 900, 1200)} alt={d.hero.alt} loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
            <div className="mt-auto p-6 text-white">
              <p className="font-display text-4xl">{d.label}</p>
              <p className="mt-1 text-sm text-white/85">{d.line}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">Explore <ChevronRight size={16} className="transition group-hover:translate-x-1" /></span>
            </div>
          </Link>
        ))}
      </section>

      {featured?.items.length ? (
        <Section eyebrow="Customer favourites" title="Bestsellers" href="/search?featured=true">
          <ProductRail items={featured.items} />
        </Section>
      ) : null}

      {/* festive banner */}
      <section className="container-page mt-20">
        <div className="grid overflow-hidden rounded-3xl bg-[#3B1F1A] text-white md:grid-cols-2">
          <div className="flex flex-col justify-center p-10 lg:p-14">
            <p className="eyebrow text-[#E7C98B]">The Festive Edit</p>
            <h2 className="mt-3 font-display text-4xl leading-tight lg:text-5xl">Handloom sarees, chikankari &amp; silk kurtas</h2>
            <p className="mt-4 max-w-md text-sm text-white/70">Use <b className="text-white">FLAT200</b> on orders above ₹1,999.</p>
            <div className="mt-8 flex gap-3">
              <Link href="/shop/women/women-ethnic" className="btn bg-white text-ink hover:bg-paper">Shop women’s ethnic</Link>
              <Link href="/shop/men/men-ethnic" className="btn border border-white/30 text-white hover:border-white">Men’s kurtas</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 p-6 lg:p-8">
            {(women?.items ?? []).slice(0, 4).map((p) => (
              <Link key={p.id} href={`/p/${p.slug}`} className="overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image!} alt={p.name} className="aspect-square h-full w-full object-cover transition hover:scale-105" />
              </Link>
            ))}
          </div>
        </div>
      </section>

      {fresh?.items.length ? (
        <Section eyebrow="Just landed" title="New arrivals" href="/search?sort=newest">
          <ProductRail items={fresh.items} />
        </Section>
      ) : null}

      {kids?.items.length ? (
        <Section eyebrow="Little Ink" title="Kidswear they’ll live in" href="/shop/kids">
          <ProductRail items={kids.items} />
        </Section>
      ) : null}
    </>
  );
}
