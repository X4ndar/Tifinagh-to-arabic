# syntax=docker/dockerfile:1
# Web page + JSON API for amazigh-transliterate. Listens on $PORT (default 3000).
# NODE_IMAGE can point at a mirror of the official image if Docker Hub rate-limits
# your server, e.g. --build-arg NODE_IMAGE=public.ecr.aws/docker/library/node:22-alpine
ARG NODE_IMAGE=node:22-alpine

# ── Build: compile TypeScript and the browser bundle ────────────────────────
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json tsconfig.build.json ./
COPY scripts ./scripts
COPY src ./src
RUN npm run build

# ── Runtime: no dependencies needed, only the compiled files ────────────────
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0
WORKDIR /app
COPY package.json README.md LICENSE LICENSE.upstream NOTICE.md ./
COPY docs ./docs
COPY demo/index.html ./demo/index.html
COPY demo/fonts ./demo/fonts
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
# Uses node's built-in fetch: no curl or wget needed.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "dist/server/bin.js"]
