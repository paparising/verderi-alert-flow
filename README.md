# Vederi Alert Flow

Event-driven alert management built with NestJS, React, Kafka, Postgres, and WebSockets. This README now replaces the scattered Markdown docs; everything you need is here.

## Architecture

- **frontend** (`packages/frontend`): React + TypeScript served by Nginx.
- **backend-api** (`packages/backend-api`): REST + WebSocket gateway, Kafka producer, auth/roles.
- **backend-persistence** (`packages/backend-persistence`): Kafka consumer that persists alert events to Postgres.
- **backend-notification** (`packages/backend-notification`): Kafka consumer that emits WebSocket notifications.
- **shared** (`packages/shared`): DTOs, entities, enums shared across services.

Event flow: API writes/updates alerts → publishes to Kafka → persistence consumer stores history → notification consumer pushes real-time events. WebSockets also stream immediate alert changes from the API service.

## Quickstart

**Prereqs:** Docker + Docker Compose, Node 18+, npm.

```bash
# from repo root
cp .env.dev.example .env.dev   # if provided
docker compose --env-file .env.dev up --build
```

Services:

- Frontend: http://localhost
- API: http://localhost:3001
- Postgres: localhost:5438 (inside compose: db:5432)
- Kafka: localhost:9092 (inside compose: kafka:9092)

Stop: `docker compose down`

## Environment

Each service has `.env.dev` / `.env.prod` in its folder; compose can also read root `.env.dev` / `.env.prod`.

Common variables (root or per-service):

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`
- `KAFKA_BROKER`
- `PORT` (API external), `NODE_ENV`
- Frontend: `REACT_APP_API_URL`, `REACT_APP_WS_URL`

Priority when running compose: shell env > service `environment:` > `--env-file` > service `.env`. Keep production secrets out of git.

## Local Development

Install dependencies once: `npm run install:all`

Build all: `npm run build:all`

Run individually (after `npm run build:shared`):

- API: `npm run dev:api` (or inside package: `npm run start:dev`)
- Persistence: `npm run dev:persistence`
- Notification: `npm run dev:notification`
- Frontend: `npm run dev:frontend` (React dev server)

Tests: `npm test` (root) or per workspace (`npm run test --workspace=frontend -- --watch=false`).

## API + Auth

- Superadmin-only org management: headers `x-superuser` and `x-api-key` on `/organizations` endpoints.
- Auth: `POST /auth/login` with `email`, `password` → JWT.
- Admin-only user management: `/users` CRUD; `password` required on create, optional on update. Role defaults to `user` if omitted.
- **Superadmin cross-org user creation**: Superadmins (role: `superadmin`) can create users for any organization by including `organizationId` in the request body when calling `POST /users`.
- Alerts (admin/user): create/list/update/delete via `/alerts`; status values: `New`, `Acknowledged`, `Resolved`. Alert events history at `/alerts/{id}/events`.

Roles are enforced via JWT claims; org scoping is derived from the token (`orgId`, `userId`).

## Kafka & WebSockets

- Topic: `alert-events`
- Producer: backend-api
- Consumers: backend-persistence (`alert-events-persistence-group`), backend-notification (`alert-events-notification-group`)
- WebSocket gateway (Socket.IO) runs in backend-api and backend-notification; clients join org rooms and receive `newAlert`, `alertStatusUpdate`, `alertEvent`.

## Project Structure

```
vederi-alert-flow/
├─ packages/
│  ├─ shared/                  # DTOs, entities, enums
│  ├─ backend-api/             # REST + WS + Kafka producer (port 3001 external)
│  ├─ backend-persistence/     # Kafka consumer → Postgres
│  ├─ backend-notification/    # Kafka consumer → WebSocket
│  └─ frontend/                # React app (served by Nginx)
├─ docker-compose.yml
├─ docs/postman/vederi-alert-flow.postman_collection.json
└─ README.md (this file)
```

## Operations Cheatsheet

- Compose dev: `docker compose --env-file .env.dev up --build`
- Compose prod-ish: `docker compose --env-file .env.prod up --build -d`
- Logs (all): `docker compose logs -f`
- Scale consumers: `docker compose up --scale backend-persistence=3 --scale backend-notification=3`

## Postman Collection

Updated collection lives at `docs/postman/vederi-alert-flow.postman_collection.json` with environment variables for base URL, superadmin headers, JWTs, and sample payloads that include password fields for user create/update.

The collection includes:

- **Health** - Service health check
- **Auth** - Login with success and error scenarios
- **Organizations** - Superadmin org management (create, list, get)
- **Users** - Admin user CRUD operations
- **Alerts** - Alert lifecycle including error scenarios (400, 401, 404)
- **Error Handling Tests** - Circuit breaker, unauthorized, and forbidden scenarios

## Troubleshooting

- API can’t reach DB: confirm `DB_HOST=db` inside Docker or `localhost` locally; external port 5438 maps to container 5432.
- Kafka consumers idle: check `KAFKA_BROKER` and consumer group IDs; use `kafka-consumer-groups` inside the Kafka container.
- WebSocket issues: ensure `REACT_APP_WS_URL` matches API base; check backend logs for connection events.

## Contributing

- TypeScript across services; lint/format before PRs.
- Conventional commits preferred (feat/fix/docs/etc.).
- Keep shared changes exported from `packages/shared/src/index.ts` and rebuild shared before running dependents.
