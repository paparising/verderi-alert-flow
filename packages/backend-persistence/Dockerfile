# Multi-stage build for backend-persistence
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared package (source + dist) so npm can resolve file:../shared
COPY packages/shared ./packages/shared

# Copy backend-persistence package
COPY packages/backend-persistence/package*.json ./packages/backend-persistence/
WORKDIR /app/packages/backend-persistence
RUN npm install

COPY packages/backend-persistence ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy shared with its node_modules (has typeorm, class-validator)
COPY --from=builder /app/packages/shared ./packages/shared

WORKDIR /app/packages/shared
RUN npm install --only=production

# Copy backend-persistence
WORKDIR /app
COPY packages/backend-persistence/package*.json ./packages/backend-persistence/
COPY --from=builder /app/packages/backend-persistence/dist ./packages/backend-persistence/dist

WORKDIR /app/packages/backend-persistence
RUN npm install --only=production

CMD ["node", "dist/main.js"]
