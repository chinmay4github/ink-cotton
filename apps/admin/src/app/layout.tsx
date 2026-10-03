import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Ink & Cotton Admin', template: '%s | Ink & Cotton Admin' },
  description: 'Operations console: orders, sellers, riders, catalogue, coupons and returns.',
  robots: { index: false },
};

export const viewport: Viewport = { themeColor: '#FAF8F4', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
