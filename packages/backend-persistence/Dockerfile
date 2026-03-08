# ---------- Stage 1: install + build ----------
FROM node:20-alpine AS builder
WORKDIR /app

# 1) Copy only package manifests first (maximizes layer cache)
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend-persistence/package*.json ./packages/backend-persistence/

# 2) Install shared deps
WORKDIR /app/packages/shared
RUN npm install

# 3) Copy shared source & build
COPY packages/shared/tsconfig.json ./
COPY packages/shared/src ./src
RUN npm run build

# 4) Install backend-persistence deps (cached unless package.json changed)
WORKDIR /app/packages/backend-persistence
RUN npm install

# 5) Copy backend-persistence source & build
COPY packages/backend-persistence/tsconfig*.json ./
COPY packages/backend-persistence/nest-cli.json ./
COPY packages/backend-persistence/src ./src
RUN npm run build

# ---------- Stage 2: production ----------
FROM node:20-alpine
WORKDIR /app

# Copy shared package with built output
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
WORKDIR /app/packages/shared
RUN npm install --omit=dev

# Copy backend-persistence built output
WORKDIR /app/packages/backend-persistence
COPY --from=builder /app/packages/backend-persistence/package*.json ./
COPY --from=builder /app/packages/backend-persistence/dist ./dist
RUN npm install --omit=dev

CMD ["node", "dist/main.bundle.js"]
