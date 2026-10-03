import { notFound } from 'next/navigation';
import { Listing } from '@/components/listing';

type Props = { params: Promise<{ department: string; category: string }>; searchParams: Promise<Record<string, string | undefined>> };

export default async function Page({ params, searchParams }: Props) {
  const { department, category } = await params;
  if (!['men', 'women', 'kids'].includes(department)) notFound();
  return <Listing department={department} category={category} searchParams={await searchParams} />;
}
