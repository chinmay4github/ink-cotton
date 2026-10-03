'use client';

import { StaffLogin } from '@ic/ui/staff';
import { photo } from '@/lib/app';

export default function Login() {
  return (
    <StaffLogin
      title="Admin sign in"
      intro="Ink & Cotton operations: orders, sellers, riders, catalogue, coupons and returns."
      aside={
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo('photo-1763328719057-ff6b03c816d0', 1200, 1600)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-12 text-white">
            <p className="font-display text-4xl leading-tight">Restricted area.</p>
            <p className="mt-3 max-w-md text-sm text-white/80">Every approval and change is recorded in the audit log.</p>
          </div>
        </>
      }
    />
  );
}
