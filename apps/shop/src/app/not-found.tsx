import Link from 'next/link';
export default function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-20 text-center">
      <div>
        <p className="font-display text-8xl text-clay">404</p>
        <h1 className="mt-4 font-display text-3xl">This page wandered off</h1>
        <p className="mt-2 text-ink-mute">The product may have sold out or the link is broken.</p>
        <Link href="/" className="btn-primary mt-8">Back to shop</Link>
      </div>
    </div>
  );
}
