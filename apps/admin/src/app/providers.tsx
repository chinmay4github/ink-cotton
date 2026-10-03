'use client';

import { StaffProvider } from '@ic/ui/staff';
import { APP } from '@/lib/app';

export function Providers({ children }: { children: React.ReactNode }) {
  return <StaffProvider app={APP}>{children}</StaffProvider>;
}
