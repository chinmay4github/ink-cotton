import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import { BagDrawer } from '@/components/bag-drawer';
import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { Providers } from '@/components/providers';
import { serverApi } from '@/lib/server-api';
import type { NavDept } from '@/lib/types';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Ink & Cotton | Clothing for Men, Women & Kids', template: '%s | Ink & Cotton' },
  description: 'Shop everyday essentials, ethnic wear and kidswear. Free delivery over ₹999, easy returns and cash on delivery.',
};

export const viewport: Viewport = { themeColor: '#FAF8F4', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Render per request (API responses are still cached via fetch revalidate), so builds never bake in
  // an empty catalogue when the API isn't reachable at build time.
  await connection();
  const nav = (await serverApi<NavDept[]>('/catalog/navigation', { revalidate: 300 })) ?? [];
  return (
    <html lang="en-IN">
      <body className="min-h-screen">
        <Providers>
          <Header nav={nav} />
          <main>{children}</main>
          <Footer nav={nav} />
          <BagDrawer />
        </Providers>
      </body>
    </html>
  );
}
