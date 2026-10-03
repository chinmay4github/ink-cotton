'use client';

import { StaffLogin } from '@ic/ui/staff';
import { photo } from '@/lib/app';

export default function Login() {
  return (
    <StaffLogin
      title="Seller sign in"
      intro="Manage orders, products, stock, returns and payouts for your store."
      aside={
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo('photo-1562151270-c7d22ceb586a', 1200, 1600)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-12 text-white">
            <p className="font-display text-4xl leading-tight">Sell to shoppers across India.</p>
            <p className="mt-3 max-w-md text-sm text-white/80">Free listing, 12% commission, pickups from your door and weekly payouts.</p>
          </div>
        </>
      }
    />
  );
}
