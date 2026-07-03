# Multi-stage build for the NestJS API + worker (same image, two entrypoints).
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- deps ----
FROM base AS deps
# node-linker=hoisted installs all packages as real files in a flat node_modules/
# tree (identical to npm/yarn behaviour). Without this, pnpm uses an isolated
# virtual store where each package's transitive deps live nested inside
# node_modules/.pnpm/<pkg>/node_modules/ and are NOT present at the top level.
# Docker COPY preserves symlinks rather than following them, so packages in the
# isolated store are unreachable from the runtime image — producing "Cannot find
# module" errors for prisma, @prisma/engines, reflect-metadata, and any other
# package that is not a direct root dependency.
RUN echo "node-linker=hoisted" >> .npmrc
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/config/package.json packages/config/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

# ---- build ----
FROM deps AS build
COPY packages/config packages/config
COPY apps/api apps/api
# @aiow/config must be compiled first — its package.json points main/types at
# dist/, so the file must exist before the api build resolves the import.
RUN pnpm --filter @aiow/config build
RUN pnpm --filter @aiow/api exec prisma generate
RUN pnpm --filter @aiow/api build

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
# node_modules/ is a hoisted flat tree: every package and every transitive dep
# is a real file directly under node_modules/. COPY is a straightforward file
# copy — no symlink chains, no .pnpm virtual store to reconstruct.
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
