import type { Metadata } from 'next';
import { Listing } from '@/components/listing';

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Results for “${q}”` : 'Shop all' };
}

export default async function Page({ searchParams }: Props) {
  const sp = await searchParams;
  const title = sp.q ? `“${sp.q}”` : sp.featured ? 'Bestsellers' : sp.sort === 'newest' ? 'New arrivals' : 'Shop all';
  return <Listing searchParams={sp} title={title} />;
}
