# Ink & Cotton API. Build from the repo root:  docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ui/package.json packages/ui/
COPY apps/api/package.json apps/api/
COPY apps/shop/package.json apps/shop/
COPY apps/sell/package.json apps/sell/
COPY apps/deliver/package.json apps/deliver/
COPY apps/admin/package.json apps/admin/
RUN npm ci -w apps/api --include-workspace-root --no-audit --no-fund
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY database ./database
WORKDIR /app/apps/api
EXPOSE 4000
# migrate (schema + idempotent migrations + first-boot seed), then serve
CMD ["sh", "-c", "node dist/bootstrap/migrate.js && node dist/main.js"]
