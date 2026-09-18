# Multi-stage Dockerfile for Backstage Application (Frontend + Backend + Plugins)

# ==============================================================================
# Stage 1: Build Environment
# ==============================================================================
FROM node:20-bookworm-slim AS builder

# Install build essentials and python for native node modules (better-sqlite3, node-gyp)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      g++ \
      make \
      build-essential \
      libsqlite3-dev && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root configurations and yarn files first to leverage Docker layer caching
COPY package.json yarn.lock lerna.json backstage.json tsconfig.json .yarnrc* ./

# Copy package.json manifests from all packages and plugins in the monorepo
COPY packages/app/package.json ./packages/app/
COPY packages/backend/package.json ./packages/backend/
COPY plugins/rbac-common/package.json ./plugins/rbac-common/
COPY plugins/rbac-backend/package.json ./plugins/rbac-backend/
COPY plugins/rbac-frontend/package.json ./plugins/rbac-frontend/

# Install all workspace dependencies
RUN yarn install --frozen-lockfile --network-timeout 300000

# Copy all remaining source code
COPY . .

# Type-check all packages
RUN yarn tsc

# Build all packages, plugins, frontend bundles, and backend service
RUN yarn build:all

# Clean up dev dependencies to keep production footprint minimal
RUN rm -rf node_modules packages/*/node_modules plugins/*/node_modules && \
    yarn install --frozen-lockfile --production --network-timeout 300000

# ==============================================================================
# Stage 2: Production Runtime
# ==============================================================================
FROM node:20-bookworm-slim AS runner

# Install runtime dependencies: dumb-init for proper PID 1 signal forwarding and sqlite3 runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      dumb-init \
      libsqlite3-0 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Run as non-root node user
USER node

# Copy production node_modules and built application artifacts from the builder stage
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/packages ./packages
COPY --chown=node:node --from=builder /app/plugins ./plugins
COPY --chown=node:node --from=builder /app/package.json /app/yarn.lock ./
COPY --chown=node:node --from=builder /app/app-config*.yaml ./
COPY --chown=node:node --from=builder /app/examples ./examples
COPY --chown=node:node --from=builder /app/catalog-info.yaml ./

# Configure default environment
ENV NODE_ENV=production
ENV PORT=7007

# Backstage serves both backend APIs and the frontend SPA on port 7007
EXPOSE 7007

# Use dumb-init to gracefully handle SIGINT and SIGTERM
ENTRYPOINT ["dumb-init", "--"]

# Launch Backstage with base configuration and docker overrides
CMD ["node", "packages/backend", "--config", "app-config.yaml", "--config", "app-config.docker.yaml"]
