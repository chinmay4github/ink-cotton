# Ink & Cotton

A multi-vendor clothing marketplace for men, women and kids, split into **four separate web apps** that share one API and one PostgreSQL database.

| App | What it's for | Local | Production domain |
|---|---|---|---|
| **Shop** (`apps/shop`) | Customers: browse, bag, checkout (COD / UPI / card), live tracking with delivery OTP, returns, reviews, wishlist, notifications | http://localhost:3000 | `inkandcotton.com` |
| **Sell** (`apps/sell`) | Sellers: apply, overview & sales chart, pack orders, add products (colours × sizes), edit stock & price, receive returns, payouts | http://localhost:3001 | `sell.inkandcotton.com` |
| **Deliver** (`apps/deliver`) | Riders (mobile-first): apply, go online, accept jobs, pickup → transit → out for delivery, OTP hand-over, failed attempts, return pickups, earnings | http://localhost:3002 | `deliver.inkandcotton.com` |
| **Admin** (`apps/admin`) | Ops: KPIs & charts, orders (assign rider, cancel), approve sellers / riders / products, feature products, coupons, returns, customers, audit log | http://localhost:3003 | `admin.inkandcotton.com` |
| **API** (`apps/api`) | NestJS + Prisma 7 on PostgreSQL, Swagger at `/docs` | http://localhost:4000 | `api.inkandcotton.com` (optional) |

> `&` isn't allowed in domain names, so the brand's domain is written **inkandcotton.com**.

## How the pieces fit

```
browser ──► shop / sell / deliver / admin  (Next.js 15, each on its own origin)
                │  /api/v1/*  same-origin proxy (packages/ui/src/proxy.ts)
                ▼
             API (NestJS) ──► PostgreSQL (schema `shop`)
```

- **Separate sessions per app.** Each app keeps its own httpOnly cookie (`ic_shop`, `ic_sell`, `ic_deliver`, `ic_admin`) and its proxy turns it into a Bearer token. Signing in to Admin never signs you in to the Shop, even on localhost where the ports share a host.
- **Each app only accepts its own accounts.** Login sends the app's role; the API refuses others ("This account can't sign in here. Use Ink & Cotton Sell instead.").
- **One order lifecycle across apps:** customer orders → seller packs → rider claims (first rider wins, enforced by a conditional update) → picked up → in transit → out for delivery (OTP generated, shown to the customer) → rider enters OTP → delivered (COD marked paid) → customer may return within 15 days → admin approves → rider collects → seller confirms receipt → refund issued, unit restocked.
- **Notifications** are written for every step to the right person (customer, seller, rider or admins) and show in each app's bell.
- **Shared code** lives in `packages/ui`: API client, proxy, formatting, garment illustrations, design tokens (Tailwind preset), staff shell/login, charts and status badges.

## Photography

Products and banners use model photography from **Unsplash** (free licence): men's styles on male models, women's on women, kidswear on children. Each product has two photos; ids live in `apps/api/src/seed/photos.json` and are served from Unsplash's CDN. Colours without a photo fall back to a generated product illustration. To use your own photography, replace the URLs in `product_images` (or the seller's "Model photo URL" field).

## Run it

**Docker (everything):**

```bash
docker compose up --build
```

**Without Docker** (Node 20+, PostgreSQL 14+):

```bash
npm install
cp apps/api/.env.example apps/api/.env            # set DATABASE_URL + JWT_SECRET
npm run build -w apps/api && npm start -w apps/api  # creates schema, applies migrations, seeds on first boot
npm run dev:shop   # :3000     npm run dev:sell    # :3001
npm run dev:deliver # :3002    npm run dev:admin   # :3003
```

On first boot the API runs `database/schema.sql`, then every file in `database/migrations/` (idempotent), then seeds demo data when `AUTO_SEED=true` and there are no users.

### Demo accounts (password `Password@123`)

| App | Account |
|---|---|
| Shop | `demo@inkandcotton.test` |
| Sell | `vendor@inkandcotton.test`, `loom@inkandcotton.test`, `little@inkandcotton.test` |
| Deliver | `rider1@inkandcotton.test`, `rider2@inkandcotton.test` |
| Admin | `admin@inkandcotton.test` |

A pending seller (*Saffron Thread*) and a pending rider (*Suresh Patil*) are waiting in Admin for approval.

## Database on Supabase

The production database is the Supabase project **ink-cotton** (region ap-south-1, Mumbai), already loaded with the schema, migrations and the demo catalogue (54 products, 1,068 size/colour variants, 594 images, 186 reviews, demo accounts).

Point the API at it with the **Session pooler** connection string from Supabase → *Connect* (it works over IPv4 from any host):

```
DATABASE_URL=postgresql://postgres.wijsyvmbuhdtfmcnqszu:<DB-PASSWORD>@<pooler-host>:5432/postgres
```

TLS is switched on automatically for Supabase URLs (`apps/api/src/common/db-url.ts`). On boot the API sees the existing tables, re-applies the idempotent migrations and skips seeding. The app tables live in the `shop` schema, which Supabase's public Data API does not expose; only the Ink & Cotton API talks to it.

## Deploy on Railway

Create one project with **Postgres** plus five services from this repo:

| Service | Dockerfile (`RAILWAY_DOCKERFILE_PATH`) | Variables |
|---|---|---|
| api | `apps/api/Dockerfile` | `DATABASE_URL=${{Postgres.DATABASE_URL}}`, `JWT_SECRET=<random 48+ chars>`, `AUTO_SEED=true`, `NODE_ENV=production` |
| shop | `docker/next.Dockerfile` | `APP=shop`, `API_URL=http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}`, `NEXT_PUBLIC_SELL_URL`, `NEXT_PUBLIC_DELIVER_URL` |
| sell | `docker/next.Dockerfile` | `APP=sell`, `API_URL=…`, `NEXT_PUBLIC_SHOP_URL` |
| deliver | `docker/next.Dockerfile` | `APP=deliver`, `API_URL=…` |
| admin | `docker/next.Dockerfile` | `APP=admin`, `API_URL=…`, `NEXT_PUBLIC_SHOP_URL` |

Give the api service `PORT=4000`, generate a domain for each web app, then attach custom domains (`inkandcotton.com`, `sell.`, `deliver.`, `admin.`) and add the DNS records Railway shows.

## Repository

```
apps/api        NestJS API: auth, catalog, cart, orders, fulfilment, returns, seller, rider, admin, notifications
apps/shop       customer storefront
apps/sell       seller centre
apps/deliver    rider app
apps/admin      operations console
packages/ui     shared client code + design tokens
database/       schema.sql + migrations/
docker/         shared Next.js Dockerfile
```
