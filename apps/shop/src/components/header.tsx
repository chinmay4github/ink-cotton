'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import type { NavDept } from '@/lib/types';
import { BagIcon, BellIcon, ChevronRight, HeartIcon, LogoutIcon, MenuIcon, PackageIcon, SearchIcon, UserIcon, XIcon } from './icons';
import { useAuth, useBag } from './providers';

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={clsx('font-display text-[25px] font-semibold leading-none tracking-[0.02em] text-ink', className)} aria-label="Ink & Cotton home">
      Ink <span className="italic text-clay">&amp;</span> Cotton
    </Link>
  );
}

function SearchBox({ onDone, autoFocus }: { onDone?: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        onDone?.();
      }}
    >
      <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus={autoFocus}
        placeholder="Search kurtas, jeans, dresses…"
        className="w-full rounded-full border border-transparent bg-paper-warm py-2.5 pl-10 pr-4 text-sm placeholder:text-ink-mute focus:border-paper-line focus:bg-white focus:outline-none"
        aria-label="Search products"
      />
    </form>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (user === undefined) return <span className="h-10 w-10" />;
  if (!user)
    return (
      <Link href="/login" className="btn-ghost rounded-full p-2.5" aria-label="Log in"><UserIcon /></Link>
    );
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-semibold text-white" aria-label="Account menu" aria-expanded={open}>
        {user.full_name[0]}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-40 w-60 animate-fade-up overflow-hidden rounded-2xl border border-paper-line bg-white py-2 shadow-card">
          <div className="border-b border-paper-line px-4 pb-3 pt-1">
            <p className="text-sm font-semibold">{user.full_name}</p>
            <p className="truncate text-xs text-ink-mute">{user.email}</p>
          </div>
          {[
            ['/orders', 'Orders', PackageIcon],
            ['/wishlist', 'Wishlist', HeartIcon],
            ['/notifications', 'Notifications', BellIcon],
            ['/account', 'Profile & addresses', UserIcon],
          ].map(([href, label, Icon]: any) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-paper">
              <Icon size={17} className="text-ink-mute" /> {label}
            </Link>
          ))}
          <button onClick={() => { setOpen(false); logout(); }} className="flex w-full items-center gap-3 border-t border-paper-line px-4 py-2.5 text-sm hover:bg-paper">
            <LogoutIcon size={17} className="text-ink-mute" /> Log out
          </button>
        </div>
      )}
    </div>
  );
}

export function Header({ nav }: { nav: NavDept[] }) {
  const { user } = useAuth();
  const bag = useBag();
  const pathname = usePathname();
  const [menu, setMenu] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: unread } = useSWR<{ unread: number }>(user ? '/notifications/unread-count' : null, { refreshInterval: 30_000 });

  useEffect(() => {
    setMenu(null);
    setMobile(false);
    setSearchOpen(false);
  }, [pathname]);

  const active = nav.find((d) => d.department === menu);

  return (
    <header className="sticky top-0 z-40 border-b border-paper-line bg-paper/95 backdrop-blur" onMouseLeave={() => setMenu(null)}>
      <div className="bg-ink py-2 text-center text-[11px] font-medium tracking-wide text-white/90">
        Free delivery over ₹999 · 15-day easy returns · Cash on delivery available
      </div>
      <div className="container-page flex h-16 items-center gap-4 lg:gap-8">
        <button className="-ml-2 p-2 lg:hidden" onClick={() => setMobile(true)} aria-label="Open menu"><MenuIcon /></button>
        <Logo />
        <nav className="hidden h-full items-stretch lg:flex" aria-label="Departments">
          {nav.map((d) => (
            <Link
              key={d.department}
              href={`/shop/${d.department}`}
              onMouseEnter={() => setMenu(d.department)}
              className={clsx('flex items-center border-b-2 px-4 text-sm font-semibold uppercase tracking-[0.12em] transition',
                menu === d.department || pathname.startsWith(`/shop/${d.department}`) ? 'border-clay text-ink' : 'border-transparent text-ink-soft hover:text-ink')}
            >
              {d.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden max-w-sm flex-1 md:block">
          <Suspense><SearchBox /></Suspense>
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <button className="btn-ghost rounded-full p-2.5 md:hidden" onClick={() => setSearchOpen((s) => !s)} aria-label="Search"><SearchIcon /></button>
          {user && (
            <Link href="/notifications" className="btn-ghost relative hidden rounded-full p-2.5 sm:inline-flex" aria-label="Notifications">
              <BellIcon />
              {!!unread?.unread && <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-clay px-1 text-[10px] font-bold text-white">{unread.unread > 9 ? '9+' : unread.unread}</span>}
            </Link>
          )}
          <Link href="/wishlist" className="btn-ghost hidden rounded-full p-2.5 sm:inline-flex" aria-label="Wishlist"><HeartIcon /></Link>
          <button onClick={() => bag.openDrawer(true)} className="btn-ghost relative rounded-full p-2.5" aria-label={`Bag, ${bag.count} items`}>
            <BagIcon />
            {bag.count > 0 && <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-ink px-1 text-[10px] font-bold text-white">{bag.count}</span>}
          </button>
          <AccountMenu />
        </div>
      </div>

      {searchOpen && (
        <div className="container-page pb-3 md:hidden"><Suspense><SearchBox autoFocus onDone={() => setSearchOpen(false)} /></Suspense></div>
      )}

      {/* mega menu */}
      {active && (
        <div className="absolute inset-x-0 top-full hidden border-b border-paper-line bg-white shadow-card lg:block" onMouseEnter={() => setMenu(active.department)}>
          <div className="container-page grid grid-cols-5 gap-8 py-8">
            {active.categories.map((c) => (
              <div key={c.id}>
                <Link href={`/shop/${active.department}/${c.slug}`} className="text-sm font-semibold text-clay hover:underline">{c.name}</Link>
                <ul className="mt-3 space-y-2">
                  {c.children.map((ch) => (
                    <li key={ch.id}><Link href={`/shop/${active.department}/${ch.slug}`} className="text-sm text-ink-soft hover:text-ink">{ch.name}</Link></li>
                  ))}
                  <li><Link href={`/shop/${active.department}/${c.slug}`} className="text-sm text-ink-soft hover:text-ink">View all</Link></li>
                </ul>
              </div>
            ))}
            <Link href={`/shop/${active.department}?sort=newest`} className="rounded-2xl bg-paper-warm p-5">
              <p className="eyebrow">Just in</p>
              <p className="mt-2 font-display text-2xl leading-tight">New arrivals for {active.label}</p>
              <p className="mt-4 inline-flex items-center gap-1 text-sm font-semibold">Shop now <ChevronRight size={16} /></p>
            </Link>
          </div>
        </div>
      )}

      {/* mobile drawer */}
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobile(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col overflow-y-auto bg-paper">
            <div className="flex items-center justify-between border-b border-paper-line px-5 py-4">
              <Logo />
              <button onClick={() => setMobile(false)} aria-label="Close menu"><XIcon /></button>
            </div>
            {nav.map((d) => (
              <details key={d.department} className="border-b border-paper-line px-5 py-4">
                <summary className="cursor-pointer list-none text-sm font-semibold uppercase tracking-[0.12em]">{d.label}</summary>
                <div className="mt-3 space-y-3 pl-2">
                  <Link href={`/shop/${d.department}`} className="block text-sm font-medium">All {d.label}</Link>
                  {d.categories.map((c) => (
                    <div key={c.id}>
                      <Link href={`/shop/${d.department}/${c.slug}`} className="block text-sm text-clay">{c.name}</Link>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {c.children.map((ch) => <Link key={ch.id} href={`/shop/${d.department}/${ch.slug}`} className="chip">{ch.name}</Link>)}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
            <div className="space-y-1 px-3 py-4">
              {[['/orders', 'Orders'], ['/wishlist', 'Wishlist'], ['/notifications', 'Notifications'], ['/account', 'Account']].map(([h, l]) => (
                <Link key={h} href={h} className="block rounded-lg px-2 py-2 text-sm hover:bg-paper-warm">{l}</Link>
              ))}
              {!user && <Link href="/login" className="btn-primary mt-3 w-full">Log in / Sign up</Link>}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
