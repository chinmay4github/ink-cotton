import { garmentSvg } from '@ic/ui/garments';

// Illustrations are deterministic per URL, so cache them forever at the browser and CDN.
export async function GET(_req: Request, ctx: { params: Promise<{ kind: string; hex: string; view: string }> }) {
  const { kind, hex, view } = await ctx.params;
  return new Response(garmentSvg(kind, hex, view.replace(/\.svg$/, '')), {
    headers: { 'content-type': 'image/svg+xml', 'cache-control': 'public, max-age=31536000, immutable' },
  });
}
