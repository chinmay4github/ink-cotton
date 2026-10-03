'use client';

import { StaffLogin } from '@ic/ui/staff';
import { photo } from '@/lib/app';

export default function Login() {
  return (
    <StaffLogin
      title="Rider sign in"
      intro="See delivery jobs near you, hand over with the customer’s OTP and track your earnings."
      aside={
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo('photo-1617114919297-3c8ddb01f599', 1200, 1600)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-12 text-white">
            <p className="font-display text-4xl leading-tight">Ride with Ink &amp; Cotton.</p>
            <p className="mt-3 max-w-md text-sm text-white/80">₹45 per delivery, ₹30 per return pickup. Choose your own hours.</p>
          </div>
        </>
      }
    />
  );
}
