import type { StaffApp } from '@ic/ui/staff';

export const APP: StaffApp = {
  key: 'sell',
  name: 'Sell',
  role: 'vendor',
  tagline: 'Seller centre',
  nav: [
    { href: '/', label: 'Overview', icon: 'chart' },
    { href: '/orders', label: 'Orders', icon: 'box' },
    { href: '/products', label: 'Products', icon: 'tag' },
    { href: '/returns', label: 'Returns', icon: 'return' },
    { href: '/payouts', label: 'Payouts', icon: 'wallet' },
  ],
  demo: [
    { identifier: 'vendor@inkandcotton.test', label: 'seller (Ink & Cotton Official)' },
    { identifier: 'loom@inkandcotton.test', label: 'seller (Indigo Loom Studio)' },
  ],
  signupHref: '/register',
  signupLabel: 'Apply to sell on Ink & Cotton',
};

export const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL ?? 'http://localhost:3000';
export const photo = (id: string, w: number, h: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
