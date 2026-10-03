import { Prisma } from '../generated/prisma/client';

export type Num = number | Prisma.Decimal | string;

export const n = (v: Num | null | undefined): number => (v == null ? 0 : typeof v === 'number' ? v : Number(v));

/** Round to paise. */
export const r2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Prices are GST-inclusive (Indian retail norm); return the tax component contained in `gross`. */
export const inclusiveTax = (gross: number, taxPct: number) => r2(gross - gross / (1 + taxPct / 100));

export const FREE_SHIPPING_THRESHOLD = 999;
export const SHIPPING_FEE = 79;
export const shippingFor = (subtotalAfterDiscount: number) =>
  subtotalAfterDiscount === 0 || subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
