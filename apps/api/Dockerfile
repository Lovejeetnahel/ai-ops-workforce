# Multi-stage build for the NestJS API + worker (same image, two entrypoints).
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY packages/config packages/config
COPY apps/api apps/api
# @aiow/config's package.json points main/types at dist/ — it must be compiled
# before the api is built or run, or Node will fail to resolve it at runtime.
RUN pnpm --filter @aiow/config build
RUN pnpm --filter @aiow/api exec prisma generate
RUN pnpm --filter @aiow/api build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/prisma ./prisma
COPY --from=build /repo/apps/api/package.json ./package.json
RUN chown -R node:node /repo
USER node
EXPOSE 4000
# Run migrations then start the API. The worker overrides CMD in compose.
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node dist/main.js"]
