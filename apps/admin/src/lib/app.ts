import type { StaffApp } from '@ic/ui/staff';

export const APP: StaffApp = {
  key: 'admin',
  name: 'Admin',
  role: 'admin',
  tagline: 'Operations console',
  nav: [
    { href: '/', label: 'Overview', icon: 'chart' },
    { href: '/orders', label: 'Orders', icon: 'box' },
    { href: '/sellers', label: 'Sellers', icon: 'store' },
    { href: '/riders', label: 'Riders', icon: 'bike' },
    { href: '/products', label: 'Catalogue', icon: 'tag' },
    { href: '/returns', label: 'Returns', icon: 'return' },
    { href: '/coupons', label: 'Coupons', icon: 'ticket' },
    { href: '/customers', label: 'Customers', icon: 'user' },
    { href: '/audit', label: 'Audit log', icon: 'shield' },
  ],
  demo: [{ identifier: 'admin@inkandcotton.test', label: 'admin' }],
};

export const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL ?? 'http://localhost:3000';
export const photo = (id: string, w: number, h: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
