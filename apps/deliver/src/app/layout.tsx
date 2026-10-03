import type { Metadata, Viewport } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Ink & Cotton Deliver', template: '%s | Ink & Cotton Deliver' },
  description: 'Rider app: delivery jobs, OTP hand-over, return pickups and earnings.',
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
