import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const I = ({ size = 20, children, ...p }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    {children}
  </svg>
);

export const SearchIcon = (p: P) => <I {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></I>;
export const BagIcon = (p: P) => <I {...p}><path d="M6 7h12l1 13H5L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></I>;
export const HeartIcon = ({ filled, ...p }: P & { filled?: boolean }) => (
  <I {...p} fill={filled ? 'currentColor' : 'none'}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" /></I>
);
export const UserIcon = (p: P) => <I {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></I>;
export const BellIcon = (p: P) => <I {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8" /><path d="M10 21a2 2 0 0 0 4 0" /></I>;
export const MenuIcon = (p: P) => <I {...p}><path d="M4 7h16M4 12h16M4 17h16" /></I>;
export const XIcon = (p: P) => <I {...p}><path d="M6 6l12 12M18 6 6 18" /></I>;
export const ChevronDown = (p: P) => <I {...p}><path d="m6 9 6 6 6-6" /></I>;
export const ChevronRight = (p: P) => <I {...p}><path d="m9 6 6 6-6 6" /></I>;
export const ChevronLeft = (p: P) => <I {...p}><path d="m15 6-6 6 6 6" /></I>;
export const StarIcon = ({ filled = true, ...p }: P & { filled?: boolean }) => (
  <I {...p} fill={filled ? 'currentColor' : 'none'} strokeWidth={1.3}><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /></I>
);
export const TruckIcon = (p: P) => <I {...p}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17.5" cy="18" r="2" /></I>;
export const ReturnIcon = (p: P) => <I {...p}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></I>;
export const ShieldIcon = (p: P) => <I {...p}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-4" /></I>;
export const CashIcon = (p: P) => <I {...p}><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></I>;
export const CheckIcon = (p: P) => <I {...p}><path d="m5 12 5 5 9-10" /></I>;
export const TagIcon = (p: P) => <I {...p}><path d="M3 12V4h8l10 10-8 8L3 12Z" /><circle cx="7.5" cy="7.5" r="1.5" /></I>;
export const TrashIcon = (p: P) => <I {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></I>;
export const MinusIcon = (p: P) => <I {...p}><path d="M5 12h14" /></I>;
export const PlusIcon = (p: P) => <I {...p}><path d="M12 5v14M5 12h14" /></I>;
export const FilterIcon = (p: P) => <I {...p}><path d="M4 6h16M7 12h10M10 18h4" /></I>;
export const PinIcon = (p: P) => <I {...p}><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12Z" /><circle cx="12" cy="9" r="2.5" /></I>;
export const PackageIcon = (p: P) => <I {...p}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></I>;
export const RulerIcon = (p: P) => <I {...p}><path d="M3 17 17 3l4 4L7 21l-4-4Z" /><path d="m7 13 2 2M10 10l2 2M13 7l2 2" /></I>;
export const LogoutIcon = (p: P) => <I {...p}><path d="M15 4h4v16h-4M10 16l4-4-4-4M14 12H4" /></I>;
