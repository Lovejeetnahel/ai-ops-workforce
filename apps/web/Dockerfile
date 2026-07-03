# Next.js standalone build.
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/config/package.json packages/config/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

FROM deps AS build
ENV NEXT_OUTPUT=standalone
COPY packages/config packages/config
COPY apps/web apps/web
# @aiow/config's package.json points main/types at dist/ — build it first.
RUN pnpm --filter @aiow/config build
RUN pnpm --filter @aiow/web build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
RUN chown -R node:node /repo
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
