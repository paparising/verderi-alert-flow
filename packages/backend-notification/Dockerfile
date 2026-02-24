# Multi-stage build for backend-notification
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared package (source + dist) so npm can resolve file:../shared
COPY packages/shared ./packages/shared

# Copy backend-notification package
COPY packages/backend-notification/package*.json ./packages/backend-notification/
WORKDIR /app/packages/backend-notification
RUN npm install

COPY packages/backend-notification ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy shared with its node_modules (has kafkajs dependencies)
COPY --from=builder /app/packages/shared ./packages/shared

WORKDIR /app/packages/shared
RUN npm install --only=production

# Copy backend-notification
WORKDIR /app
COPY packages/backend-notification/package*.json ./packages/backend-notification/
COPY --from=builder /app/packages/backend-notification/dist ./packages/backend-notification/dist

WORKDIR /app/packages/backend-notification
RUN npm install --only=production

CMD ["node", "dist/main.js"]
