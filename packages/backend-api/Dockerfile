# Multi-stage build for backend-api
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared package (source + dist) so npm can resolve file:../shared
COPY packages/shared ./packages/shared

# Copy backend-api package
COPY packages/backend-api/package*.json ./packages/backend-api/
WORKDIR /app/packages/backend-api
RUN npm install

COPY packages/backend-api ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy shared with its node_modules (has typeorm, class-validator)
COPY --from=builder /app/packages/shared ./packages/shared

WORKDIR /app/packages/shared
RUN npm install --only=production

# Copy backend-api
WORKDIR /app
COPY packages/backend-api/package*.json ./packages/backend-api/
COPY --from=builder /app/packages/backend-api/dist ./packages/backend-api/dist

WORKDIR /app/packages/backend-api
RUN npm install --only=production

EXPOSE 3000

CMD ["node", "dist/main.js"]
