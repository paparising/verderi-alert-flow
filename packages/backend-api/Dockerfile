# ---------- Stage 1: install + build ----------
FROM node:20-alpine AS builder
WORKDIR /app

# 1) Copy only package manifests first (maximizes layer cache)
COPY packages/shared/package*.json ./packages/shared/
COPY packages/backend-api/package*.json ./packages/backend-api/

# 2) Install shared deps
WORKDIR /app/packages/shared
RUN npm install

# 3) Copy shared source & build
COPY packages/shared/tsconfig.json ./
COPY packages/shared/src ./src
RUN npm run build

# 4) Install backend-api deps (cached unless package.json changed)
WORKDIR /app/packages/backend-api
RUN npm install

# 5) Copy backend-api source & build
COPY packages/backend-api/tsconfig*.json ./
COPY packages/backend-api/nest-cli.json ./
COPY packages/backend-api/src ./src
RUN npm run build

# ---------- Stage 2: production ----------
FROM node:20-alpine
WORKDIR /app

# Copy shared package with built output
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
WORKDIR /app/packages/shared
RUN npm install --omit=dev

# Copy backend-api built output
WORKDIR /app/packages/backend-api
COPY --from=builder /app/packages/backend-api/package*.json ./
COPY --from=builder /app/packages/backend-api/dist ./dist
RUN npm install --omit=dev

EXPOSE 3000
CMD ["node", "dist/main.bundle.js"]
