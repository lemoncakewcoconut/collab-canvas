# Stage 1: Build all workspaces (shared, server, client)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests for layer caching
COPY package.json package-lock.json* ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install

# Copy all sources and configs
COPY tsconfig.json ./
COPY shared/ ./shared/
COPY server/ ./server/
COPY client/ ./client/

# Build shared library, server, and client Vite bundle
RUN npm run build --workspace=shared
RUN npm run build --workspace=server
RUN npm run build --workspace=client

# Stage 2: Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/app/data
ENV MAX_UPLOAD_MB=25
ENV UPLOAD_CHUNK_MB=1

# Copy root dependencies and compiled dists
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/package.json ./client/package.json
COPY --from=builder /app/client/dist ./client/dist

# Expose server port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

# Start production server
CMD ["node", "server/dist/index.js"]
