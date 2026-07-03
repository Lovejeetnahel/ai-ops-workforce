# Multi-stage build for the NestJS API + worker (same image, two entrypoints).
#
# Debian slim, not alpine: Prisma's engines are built and tested against
# glibc + OpenSSL 3 (debian-openssl-3.0.x). On alpine/musl the schema engine
# failed libssl detection during `migrate deploy` and crashed with
# "Could not parse schema engine response".
FROM node:20-slim AS base
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /repo

# ---- build ----
FROM base AS build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/config packages/config
COPY apps/api apps/api
RUN pnpm install --frozen-lockfile
# @aiow/config must be compiled first — its package.json points main/types at
# dist/, so the file must exist before the api build resolves the import.
RUN pnpm --filter @aiow/config build
RUN pnpm --filter @aiow/api exec prisma generate
RUN pnpm --filter @aiow/api build
# `pnpm deploy` produces a fully self-contained production bundle at /out:
# the api package files (dist/, prisma/, package.json) plus a complete
# node_modules containing ALL production deps — including workspace packages
# like @aiow/config — materialized inside the bundle with internal links only.
# Nothing in /out references the monorepo layout, so copying it to the runtime
# image cannot drop transitive packages (the failure mode behind every
# previous "Cannot find module" error).
RUN pnpm --filter @aiow/api deploy --prod /out
# Regenerate the Prisma client inside the bundle so the query engine binary
# for this platform is guaranteed present in the bundle's own node_modules.
RUN cd /out && node node_modules/prisma/build/index.js generate

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /out /repo
RUN chown -R node:node /repo
USER node
EXPOSE 4000
# Run migrations then start the API. The worker overrides CMD in compose.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
