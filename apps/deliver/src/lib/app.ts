import type { StaffApp } from '@ic/ui/staff';

export const APP: StaffApp = {
  key: 'deliver',
  name: 'Deliver',
  role: 'delivery_agent',
  tagline: 'Rider app',
  nav: [
    { href: '/', label: 'Jobs', icon: 'truck' },
    { href: '/history', label: 'History', icon: 'history' },
    { href: '/earnings', label: 'Earnings', icon: 'wallet' },
    { href: '/profile', label: 'Profile', icon: 'user' },
  ],
  demo: [
    { identifier: 'rider1@inkandcotton.test', label: 'rider (Ravi Kumar)' },
    { identifier: 'rider2@inkandcotton.test', label: 'rider (Imran Shaikh)' },
  ],
  signupHref: '/register',
  signupLabel: 'Become a delivery partner',
};

export const photo = (id: string, w: number, h: number) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
