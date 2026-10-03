import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Listing } from '@/components/listing';
import { deptLabel } from '@/lib/format';
import { HERO, photo } from '@/lib/photos';

type Props = { params: Promise<{ department: string }>; searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { department } = await params;
  return { title: `${deptLabel(department)}’s Clothing` };
}

export default async function Page({ params, searchParams }: Props) {
  const { department } = await params;
  if (!['men', 'women', 'kids'].includes(department)) notFound();
  const hero = HERO[department as 'men' | 'women' | 'kids'];
  const line = { men: 'Tees, shirts, jackets, chinos and ethnic wear', women: 'Dresses, tops, kurtas, sarees and denim', kids: 'Soft, play-ready cotton for ages 0–14' }[department];
  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo(hero.id, 2000, 700)} alt={hero.alt} className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_35%]" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/65 to-black/10" />
        <div className="container-page flex min-h-[220px] flex-col justify-end py-10 sm:min-h-[280px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80">Ink &amp; Cotton</p>
          <h1 className="mt-2 font-display text-5xl">{deptLabel(department)}</h1>
          <p className="mt-2 text-sm text-white/85">{line}</p>
        </div>
      </section>
      <Listing department={department} searchParams={await searchParams} />
    </>
  );
}
