# Videri Alert Flow

Event-driven alert management platform built with NestJS, React, Kafka, PostgreSQL, and WebSockets.

## Overview

This repository contains a microservices-based alert workflow with three backend services, a frontend, and a shared domain package.

## Architecture

- frontend (`packages/frontend`): React + TypeScript UI
- backend-api (`packages/backend-api`): REST API, auth/roles, alert writes, Kafka producer
- backend-persistence (`packages/backend-persistence`): Kafka consumer that persists alert events
- backend-notification (`packages/backend-notification`): Kafka consumer + Socket.IO gateway for real-time updates
- shared (`packages/shared`): DTOs, entities, enums shared across services

Event flow:

1. API creates or updates alerts.
2. API publishes events to Kafka topic `alert-events`.
3. Persistence consumer stores alert event history.
4. Notification consumer emits real-time socket updates to organization rooms.

## Quick Start (Docker)

Prerequisites:

- Docker
- Docker Compose

From repo root:

```bash
# Optional: copy env template if you use one
cp .env.dev.example .env.dev

# Start all services
npm run docker:up
```

Equivalent compose command:

```bash
docker compose --env-file .env.dev up --build -d
```

Stop services:

```bash
npm run docker:down
```

## Local Endpoints

- Frontend: http://localhost
- API: http://localhost:3001
- WebSocket service: http://localhost:3002
- PostgreSQL host port: localhost:5438
- Kafka host port: localhost:9092

## Local Development (Without Docker)

Prerequisites:

- Node.js 18+
- npm

Install dependencies:

```bash
npm run install:all
```

Build shared and services:

```bash
npm run build:all
```

Run a service in watch mode:

```bash
npm run start:dev --workspace=@videri/backend-api
npm run start:dev --workspace=@videri/backend-persistence
npm run start:dev --workspace=@videri/backend-notification
npm run start --workspace=frontend
```

## Scripts

Root-level scripts:

- `npm run build:all`: build shared + all backend services
- `npm run test:all`: run backend + frontend tests
- `npm run test:api`
- `npm run test:persistence`
- `npm run test:notification`
- `npm run test:frontend`
- `npm run docker:up`
- `npm run docker:down`
- `npm run docker:logs`

Per-backend package scripts:

- `build`, `build:tsc`, `build:bundle`
- `start:dev`, `start:prod`
- `test`, `test:watch`, `test:cov`

## Testing and Coverage

Run all tests:

```bash
npm run test:all
```

Run package-level coverage (recommended):

```bash
npm run test:cov --workspace=@videri/backend-api
npm run test:cov --workspace=@videri/backend-persistence
npm run test:cov --workspace=@videri/backend-notification
```

Coverage output is written to each package's `coverage` folder.

Note:

- The root script `npm run test:cov` is currently less reliable for forwarding `--coverage` through workspace chaining. Prefer running coverage per workspace as shown above.

## Environment Configuration

Compose reads root env files via `--env-file`.
Each backend/frontend package may also use local env files for direct local runs.

Common variables:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`
- `KAFKA_BROKER`
- `PORT`, `NODE_ENV`
- `JWT_SECRET`, `JWT_ISSUER`, `JWT_AUDIENCE`
- `REACT_APP_API_URL`, `REACT_APP_WS_URL`
- `ALERT_EVENT_POLLING_INTERVAL_MS`

## API and Auth Highlights

- `POST /auth/login` returns JWT for authenticated users.
- User/org endpoints are role-guarded.
- Alerts endpoints support create/list/update/delete and event history retrieval.
- Org scoping is enforced through JWT claims and guard logic.

## Kafka and Real-Time

Kafka topic:

- `alert-events`

Consumer groups:

- persistence: `alert-events-persistence-group`
- notification: `alert-events-notification-group`

WebSocket behavior:

- JWT required in handshake (`auth.token` preferred)
- clients may only join room matching their JWT `orgId`
- event channels emitted: `newAlert`, `alertStatusUpdate`, `alertEvent`

## Data Model Summary

Core entities:

- Alert
- AlertEvent
- ProcessedEvent (idempotency tracking)

In development, schema sync can be automatic.
For production, use migration-driven schema management.

## Repository Layout

```text
videri-alert-flow/
├─ packages/
│  ├─ shared/
│  ├─ backend-api/
│  ├─ backend-persistence/
│  ├─ backend-notification/
│  └─ frontend/
├─ docs/
│  ├─ images/
│  └─ postman/
├─ docker-compose.yml
└─ README.md
```

## Postman

Import collection:

- `docs/postman/videri-alert-flow.postman_collection.json`

## Operations Cheat Sheet

```bash
# Build containers
npm run docker:build

# Start stack
npm run docker:up

# Tail all logs
npm run docker:logs

# Tail specific service logs
npm run docker:logs:api
npm run docker:logs:persistence
npm run docker:logs:notification

# Scale consumers (compose)
docker compose up --scale backend-persistence=3 --scale backend-notification=3
```

## Troubleshooting

Common checks:

- API cannot connect to DB: verify `DB_HOST`, port mapping, and container health.
- Consumers not processing: verify `KAFKA_BROKER` and consumer group logs.
- No real-time updates: verify `REACT_APP_WS_URL`, socket token, and orgId join.
- Forbidden room join: requested org differs from JWT `orgId`.

Useful reset command:

```bash
docker compose down -v
```

## Additional Documentation

This README is the primary starting point. Additional focused docs are still available:

- `PROJECT_STRUCTURE.md`
- `MICROSERVICES.md`
- `WEBSOCKET.md`
- `KAFKA.md`
- `TEST_RUNNING_GUIDE.md`
- `TEST_SUITE_DOCUMENTATION.md`
- `ENV_CONFIGURATION.md`
- `CONTRIBUTING.md`

## Contributing

- Use conventional commit messages (`feat`, `fix`, `docs`, etc.) where possible.
- Keep shared contract exports updated in `packages/shared/src/index.ts`.
- Rebuild shared package before testing dependent services.
