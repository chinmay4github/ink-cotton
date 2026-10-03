'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import useSWR, { SWRConfig, useSWRConfig } from 'swr';
import { api, ApiError, fetcher } from '@/lib/api';
import type { CartLine, CartQuote, User } from '@/lib/types';

// ============================================================ toasts
type Toast = { id: number; text: string; tone: 'ok' | 'err' };
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);

function ToastHost({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[100] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`animate-fade-up rounded-full px-5 py-3 text-sm font-medium shadow-card ${t.tone === 'err' ? 'bg-clay text-white' : 'bg-ink text-white'}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ============================================================ auth
interface AuthCtxT {
  user: User | null | undefined; // undefined = loading
  login: (identifier: string, password: string) => Promise<void>;
  register: (d: { fullName: string; email: string; phone?: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => void;
}
const AuthCtx = createContext<AuthCtxT>(null as any);
export const useAuth = () => useContext(AuthCtx);

// ============================================================ bag (cart)
const GUEST_KEY = 'ic_bag_v1';
type GuestItem = { variantId: number; quantity: number };
const readGuest = (): GuestItem[] => {
  try {
    return JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]');
  } catch {
    return [];
  }
};
const writeGuest = (items: GuestItem[]) => {
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify(items));
  } catch {
    /* private mode */
  }
};

interface BagCtxT {
  quote: CartQuote | undefined;
  count: number;
  loading: boolean;
  coupon: string | null;
  setCoupon: (c: string | null) => void;
  add: (variantId: number, quantity?: number) => Promise<boolean>;
  setQty: (line: CartLine, qty: number) => Promise<void>;
  changeSize: (line: CartLine, variantId: number) => Promise<void>;
  remove: (line: CartLine) => Promise<void>;
  drawerOpen: boolean;
  openDrawer: (open: boolean) => void;
  reload: () => void;
}
const BagCtx = createContext<BagCtxT>(null as any);
export const useBag = () => useContext(BagCtx);

function Inner({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: user, mutate: mutateUser } = useSWR<User | null>('/auth/me', fetcher, { revalidateOnFocus: false });
  const isCustomer = !!user && user.role === 'customer';

  // --- guest bag lives in localStorage and is priced by the public /cart/quote endpoint
  const [guest, setGuest] = useState<GuestItem[]>([]);
  useEffect(() => setGuest(readGuest()), []);
  const [coupon, setCoupon] = useState<string | null>(null);
  const [drawerOpen, openDrawer] = useState(false);

  const cartKey = isCustomer ? `/cart${coupon ? `?coupon=${encodeURIComponent(coupon)}` : ''}` : null;
  const serverBag = useSWR<CartQuote>(cartKey, fetcher, { keepPreviousData: true });
  const guestKey = user === null && guest.length ? ['guest-quote', JSON.stringify(guest)] : null;
  const guestBag = useSWR<CartQuote>(guestKey, () => api('/cart/quote', { method: 'POST', json: { items: guest } }), { keepPreviousData: true });

  const quote = isCustomer ? serverBag.data : user === null ? (guest.length ? guestBag.data : EMPTY) : undefined;
  const count = quote?.itemCount ?? 0;

  const updateGuest = (items: GuestItem[]) => {
    const clean = items.filter((i) => i.quantity > 0);
    writeGuest(clean);
    setGuest(clean);
  };

  /** Move the browser (guest) bag into the account. Awaited by login/register before navigating away,
   *  and the local copy is cleared first so a reload can never merge it twice. */
  const mergeGuest = async () => {
    const items = readGuest();
    if (!items.length) return;
    writeGuest([]);
    setGuest([]);
    try {
      await api('/cart/merge', { method: 'POST', json: { items } });
    } catch {
      writeGuest(items); // keep them if the merge failed
    }
  };

  const fail = (e: unknown) => toast(e instanceof ApiError ? e.message : 'Something went wrong', 'err');

  const bag: BagCtxT = {
    quote,
    count,
    loading: isCustomer ? serverBag.isLoading : guestBag.isLoading,
    coupon,
    setCoupon,
    drawerOpen,
    openDrawer,
    // revalidate every cached bag variant (with/without coupon) so no stale copy survives checkout
    reload: () => { globalMutate((k) => typeof k === 'string' && k.startsWith('/cart')); guestBag.mutate(); },
    add: async (variantId, quantity = 1) => {
      try {
        if (isCustomer) serverBag.mutate(await api<CartQuote>('/cart/items', { method: 'POST', json: { variantId, quantity } }), false);
        else if (user && !isCustomer) {
          toast('Log in with a customer account to shop', 'err');
          return false;
        } else {
          const cur = readGuest();
          const found = cur.find((i) => i.variantId === variantId);
          const next = found ? cur.map((i) => (i.variantId === variantId ? { ...i, quantity: Math.min(10, i.quantity + quantity) } : i)) : [{ variantId, quantity }, ...cur];
          // validate stock via the quote before committing
          const q = await api<CartQuote>('/cart/quote', { method: 'POST', json: { items: next } });
          const line = q.lines.find((l) => l.variantId === variantId);
          if (line?.issue) throw new ApiError(400, line.issue === 'insufficient_stock' ? `Only ${line.available} left in stock` : 'This size is out of stock');
          updateGuest(next);
          guestBag.mutate(q, false);
        }
        openDrawer(true);
        return true;
      } catch (e) {
        fail(e);
        return false;
      }
    },
    setQty: async (line, qty) => {
      try {
        if (isCustomer) serverBag.mutate(await api<CartQuote>(`/cart/items/${line.id}`, { method: 'PATCH', json: { quantity: qty } }), false);
        else updateGuest(readGuest().map((i) => (i.variantId === line.variantId ? { ...i, quantity: qty } : i)));
      } catch (e) {
        fail(e);
      }
    },
    changeSize: async (line, variantId) => {
      try {
        if (isCustomer) serverBag.mutate(await api<CartQuote>(`/cart/items/${line.id}`, { method: 'PATCH', json: { variantId } }), false);
        else updateGuest([...readGuest().filter((i) => i.variantId !== line.variantId), { variantId, quantity: line.quantity }]);
      } catch (e) {
        fail(e);
      }
    },
    remove: async (line) => {
      try {
        if (isCustomer) serverBag.mutate(await api<CartQuote>(`/cart/items/${line.id}`, { method: 'DELETE' }), false);
        else updateGuest(readGuest().filter((i) => i.variantId !== line.variantId));
      } catch (e) {
        fail(e);
      }
    },
  };

  const auth: AuthCtxT = {
    user,
    refresh: () => mutateUser(),
    login: async (identifier, password) => {
      const r = await api<{ user: User }>('/auth/login', { method: 'POST', json: { identifier, password, role: 'customer' } });
      if (r.user.role === 'customer') await mergeGuest();
      await mutateUser(r.user as User, false);
    },
    register: async (d) => {
      const r = await api<{ user: User }>('/auth/register', { method: 'POST', json: d });
      await mergeGuest();
      await mutateUser(r.user as User, false);
    },
    logout: async () => {
      await api('/auth/logout', { method: 'POST' });
      await mutateUser(null, false);
      setCoupon(null);
      // drop every cached personal resource
      globalMutate((k) => typeof k === 'string' && k !== '/auth/me', undefined, { revalidate: false });
      window.location.assign('/');
    },
  };

  return (
    <AuthCtx.Provider value={auth}>
      <BagCtx.Provider value={bag}>
        <WishlistProvider>{children}</WishlistProvider>
      </BagCtx.Provider>
    </AuthCtx.Provider>
  );
}

const EMPTY: CartQuote = {
  lines: [], itemCount: 0, mrpTotal: 0, subtotal: 0, productDiscount: 0, couponDiscount: 0, coupon: null, couponError: null,
  shipping: 0, freeShippingThreshold: 999, amountToFreeShipping: 0, tax: 0, total: 0, hasIssues: false,
};

// ============================================================ wishlist
interface WishCtxT { has: (productId: number) => boolean; toggle: (productId: number) => Promise<void> }
const WishCtx = createContext<WishCtxT>(null as any);
export const useWishlist = () => useContext(WishCtx);

function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { mutate: globalMutate } = useSWRConfig();
  const { data: ids, mutate } = useSWR<number[]>(user?.role === 'customer' ? '/wishlist/ids' : null, fetcher);
  const set = useMemo(() => new Set(ids ?? []), [ids]);

  const value: WishCtxT = {
    has: (id) => set.has(id),
    toggle: async (id) => {
      if (!user) {
        router.push(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
        return;
      }
      const had = set.has(id);
      mutate(had ? (ids ?? []).filter((x) => x !== id) : [...(ids ?? []), id], false);
      try {
        await api(`/wishlist/${id}`, { method: had ? 'DELETE' : 'POST' });
        toast(had ? 'Removed from wishlist' : 'Saved to wishlist');
        globalMutate('/wishlist');
      } catch {
        mutate();
        toast('Could not update wishlist', 'err');
      }
    },
  };
  return <WishCtx.Provider value={value}>{children}</WishCtx.Provider>;
}

// ============================================================ root
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig value={{ fetcher, shouldRetryOnError: false, dedupingInterval: 2000 }}>
      <ToastHost>
        <Inner>{children}</Inner>
      </ToastHost>
    </SWRConfig>
  );
}
