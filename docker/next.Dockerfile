# One Dockerfile for all four web apps. Build from the repo root:
#   docker build -f docker/next.Dockerfile --build-arg APP=shop .
FROM node:22-alpine AS build
ARG APP=shop
ARG API_URL=http://localhost:4000
ARG NEXT_PUBLIC_SHOP_URL
ARG NEXT_PUBLIC_SELL_URL
ARG NEXT_PUBLIC_DELIVER_URL
ENV NEXT_TELEMETRY_DISABLED=1 API_URL=$API_URL NEXT_PUBLIC_SHOP_URL=$NEXT_PUBLIC_SHOP_URL NEXT_PUBLIC_SELL_URL=$NEXT_PUBLIC_SELL_URL NEXT_PUBLIC_DELIVER_URL=$NEXT_PUBLIC_DELIVER_URL
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
COPY apps/shop/package.json apps/shop/
COPY apps/sell/package.json apps/sell/
COPY apps/deliver/package.json apps/deliver/
COPY apps/admin/package.json apps/admin/
RUN npm ci -w apps/${APP} --include-workspace-root --no-audit --no-fund
COPY packages/ui packages/ui
COPY apps/${APP} apps/${APP}
RUN npm run build -w apps/${APP}

FROM node:22-alpine
ARG APP=shop
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 APP=${APP}
WORKDIR /app
COPY --from=build /app/apps/${APP}/.next/standalone ./
COPY --from=build /app/apps/${APP}/.next/static ./apps/${APP}/.next/static
EXPOSE 3000
CMD ["sh", "-c", "node apps/$APP/server.js"]
