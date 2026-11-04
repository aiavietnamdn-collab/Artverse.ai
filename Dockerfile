# ============================================================================
# Stage 1: Build Frontend (Vite 8 + React 19) & Backend (esbuild -> server.js)
# ============================================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies using package.json and lockfile
COPY package.json package-lock.json* bun.lock* ./
RUN npm install

# Copy application source and configuration files (no .env or secrets)
COPY tsconfig.json vite.config.ts capacitor.config.ts index.html metadata.json firebase-applet-config.json server.ts ./
COPY public ./public
COPY src ./src

# Build production client (dist/) and bundle Express server (server.js)
RUN npm run build

# Remove devDependencies to keep runtime image lean
RUN npm prune --omit=dev

# ============================================================================
# Stage 2: Production Runner for Google Cloud Run
# ============================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Copy production dependencies and compiled artifacts only
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

# Run as non-root user for Cloud Run security
USER node

EXPOSE 8080

CMD ["npm", "start"]
