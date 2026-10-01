# One image: the Hono server, serving the JSON API, the built SPA and the
# in-process poller on one port (Northflank combined service).

FROM oven/bun:1.3.14 AS build
WORKDIR /app

# Install with the lockfile first, so a source-only change reuses the layer.
COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .
RUN bun run --filter @wow-locker/web build

FROM oven/bun:1.3.14
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/turbo.json ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/web/dist ./apps/web/dist

WORKDIR /app/apps/api
EXPOSE 3000
# Migrate (idempotent), then start. The server backfills the tracker history in
# the background on first boot, so a fresh deploy needs no manual seeding.
CMD ["sh", "-c", "bun src/db/migrate.ts && bun src/server.ts"]
