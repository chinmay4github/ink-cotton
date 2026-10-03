import { randomInt } from 'crypto';

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

const rand = (len: number) => Array.from({ length: len }, () => ALPHA[randomInt(ALPHA.length)]).join('');

const ymd = (d = new Date()) => d.toISOString().slice(2, 10).replace(/-/g, '');

/** e.g. KP260924-7HQ4MZ - date-prefixed so it sorts and tells support when the order was placed. */
export const orderNumber = () => `IC${ymd()}-${rand(6)}`;

export const trackingNumber = () => `ICX${ymd()}${rand(7)}`;

export const otp = () => String(randomInt(100000, 1000000));
