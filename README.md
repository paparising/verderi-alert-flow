# Videri Alert Flow

Event-driven alert management built with NestJS, React, Kafka, Postgres, and WebSockets. This README now replaces the scattered Markdown docs; everything you need is here.

## Architecture

- **frontend** (`packages/frontend`): React + TypeScript served by Nginx.
- **backend-api** (`packages/backend-api`): REST API, Kafka producer, auth/roles.
- **backend-persistence** (`packages/backend-persistence`): Kafka consumer that persists alert events to Postgres.
- **backend-notification** (`packages/backend-notification`): Kafka consumer + WebSocket server that emits real-time notifications.
- **shared** (`packages/shared`): DTOs, entities, enums shared across services.

Event flow: API writes/updates alerts → publishes to Kafka → persistence consumer stores history → notification consumer pushes real-time events via WebSockets.

## Quickstart

# Videri Alert Flow

Event-driven alert management built with NestJS, React, Kafka, PostgreSQL, and WebSockets. This README consolidates the key developer and operations information.

## Architecture

- **frontend** (`packages/frontend`): React + TypeScript served by Nginx.
- **backend-api** (`packages/backend-api`): REST API, Kafka producer, authentication and role enforcement (port 3001).
- **backend-persistence** (`packages/backend-persistence`): Kafka consumer that persists alert events to Postgres.
- **backend-notification** (`packages/backend-notification`): Kafka consumer + WebSocket server (Socket.IO) that emits real-time notifications (port 3002).
- **shared** (`packages/shared`): DTOs, entities and enums shared across services.

Event flow: API writes/updates alerts → publishes to Kafka (`alert-events`) → persistence consumer stores history → notification consumer pushes real-time events via WebSockets.

## Quickstart

Prerequisites: Docker, Docker Compose, Node.js (recommended 18+), npm.

From the repository root:

```bash
# copy an example env if needed
cp .env.dev.example .env.dev

docker compose --env-file .env.dev up --build
```

Service endpoints (local):

- Frontend: http://localhost
- API: http://localhost:3001
- WebSocket (backend-notification): http://localhost:3002
- Postgres (host): localhost:5438 → container `db:5432`
- Kafka: localhost:9092 → container `kafka:9092`

Stop services:

```bash
docker compose down
```

## Environment

Each package may include `.env.dev` and `.env.prod` files. Compose can read a root `.env.dev`/`.env.prod` via `--env-file`.

### Common Variables

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` - PostgreSQL connection
- `KAFKA_BROKER` - Kafka broker address (default: `kafka:9092`)
- `PORT`, `NODE_ENV` - Server port and environment
- Frontend: `REACT_APP_API_URL`, `REACT_APP_WS_URL` - API and WebSocket URLs

### Event Processing Variables

- `ALERT_EVENT_POLLING_INTERVAL_MS` (default: 1000) - Interval in milliseconds for AlertEventProcessorService to poll and publish unpublished AlertEvents
- Kafka auto-commit: `autoCommitInterval: 5000ms`, `autoCommitThreshold: 1` - Offset commits after each successfully processed message

Precedence when running Compose: shell env > service `environment:` > `--env-file` > service `.env`.

## Local Development

- Install all deps: `npm run install:all`
- Build shared package: `npm run build:shared`
- Build all: `npm run build:all`

Run packages individually (from root or inside package):

- API (dev): `npm run dev:api` or `npm run start:dev` in `packages/backend-api`
- Persistence (dev): `npm run dev:persistence`
- Notification (dev): `npm run dev:notification`
- Frontend (dev): `npm run dev:frontend`

### Testing

Run all tests:

```bash
npm test
```

Run frontend tests:

```bash
npm run test --workspace=frontend -- --watch=false
```

Run backend-api tests (includes alert-event-processor idempotency tests):

```bash
npm run test -- backend-api
```

Run persistence service tests (includes eventData reconstruction tests):

```bash
npm run test -- backend-persistence
```

Key test suites:

- **AlertEventProcessorService.spec.ts**: Validates ProcessedEvent-based idempotency, event publishing, and transaction handling
- **EventPersistenceService.spec.ts**: Verifies Kafka message parsing, eventData reconstruction from flattened format, and duplicate handling
- **EventNotificationService.spec.ts**: Ensures WebSocket events are routed correctly and deduplication works within 2-second window

## API & Auth

- Auth: `POST /auth/login` with `email` + `password` → JWT.
- Superadmin-only org management endpoints (use appropriate superadmin headers).
- Admin user management: `/users` CRUD; `password` required on create, optional on update. Role defaults to `user`.
- Superadmins may create users for any organization by including `organizationId` in `POST /users`.
- Alerts: create/list/update/delete under `/alerts`. Statuses: `New`, `Acknowledged`, `Resolved`. Event history: `/alerts/{id}/events`.

Authorization and org scoping are enforced via JWT claims (`orgId`, `userId`).

## Kafka & WebSockets

## Kafka & Event Processing

### Topic Structure

- **Topic**: `alert-events`
- **Producer**: `backend-api` (AlertEventProcessorService) - publishes alert events at configurable polling intervals
- **Consumers**:
  - `backend-persistence` (group `alert-events-persistence-group`) - persists events to Postgres
  - `backend-notification` (group `alert-events-notification-group`) - broadcasts via WebSocket

### Event Flow & Idempotency

The system implements a robust three-layer deduplication strategy to prevent status badge flashing and duplicate notifications:

1. **Database Layer (ProcessedEvent Table)**
   - AlertEventProcessorService queries all AlertEvent records periodically (default 1s interval via `ALERT_EVENT_POLLING_INTERVAL_MS`)
   - Before publishing to Kafka, checks if ProcessedEvent record exists with status `COMPLETED`
   - Only publishes unpublished events to Kafka to prevent duplicates
   - Creates ProcessedEvent record with status `PROCESSING` -> `COMPLETED` after successful publish
   - Uses database transactions for atomicity

2. **Event Data Reconstruction**
   - AlertEventProcessorService spreads eventData at top level of Kafka message: `{ orgId, alertId, eventId, eventType, newStatus, previousStatus, ... }`
   - EventPersistenceService reconstructs eventData by extracting metadata fields (orgId, alertId, eventId, createdBy, createdAt)
   - Remaining fields become eventData: `{ eventType, newStatus, previousStatus, changedAt, ... }`
   - Prevents empty events from appearing in alert history

3. **Notification Layer (In-Memory Deduplication)**
   - EventNotificationService maintains 2-second deduplication window
   - Tracks `{eventId: {timestamp, status}}` to deduplicate identical events
   - Kafka consumer configured with `autoCommitInterval: 5000ms` and `autoCommitThreshold: 1`
   - Only commits offsets after successful WebSocket emission

4. **Frontend Layer (State Change Detection)**
   - AlertsList component only updates state if alert.status actually changed
   - Prevents unnecessary re-renders and UI flashing from duplicate status events

### WebSocket Real-time Updates

- WebSocket gateway runs in `backend-notification` (port 3002)
- Clients join organization-specific rooms
- Events emitted:
  - `newAlert` - new alert created (eventType: `ALERT_CREATED`)
  - `alertStatusUpdate` - status changed (eventType: `ALERT_STATUS_CHANGED`)
  - `alertEvent` - context changed (eventType: `ALERT_CONTEXT_CHANGED`)
- Deduplication ensures stable status badges without flashing or oscillation

## Database Schema

### Key Entities

**Alert**

- `id` (uuid, PK): Unique alert identifier
- `orgId` (uuid): Organization context
- `alertId` (uuid): Business alert ID
- `alertContext` (jsonb): Alert metadata and details
- `status` (varchar): One of `New`, `Acknowledged`, `Resolved`
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`: Audit trail

**AlertEvent**

- `id` (uuid, PK): Event record identifier
- `orgId` (uuid): Organization context
- `alertId` (uuid): Foreign key to alert
- `eventId` (uuid): Unique event ID (for idempotency)
- `eventData` (jsonb): Event details including eventType, status changes, context
- `createdAt`, `createdBy`: Creation metadata
- Indexed on `orgId` and `alertId` for efficient querying

**ProcessedEvent** (Idempotency Tracking)

- `id` (uuid, PK): Record identifier
- `eventId` (uuid, UNIQUE): Links to AlertEvent.eventId for deduplication
- `status` (varchar): One of `processing`, `completed`, `failed`
- `errorMessage` (text, nullable): Error reason if failed
- `createdAt` (timestamp): Processing start time
- `completedAt` (timestamp, nullable): Processing completion time
- Ensures each event published exactly once despite multiple producer/consumer instances

### Database Initialization

TypeORM is configured with `synchronize: true` in development environments, automatically creating/updating tables from entity definitions. In production, use TypeORM migrations for schema changes.

```
videri-alert-flow/
├─ packages/
│  ├─ shared/                  # DTOs, entities, enums
│  ├─ backend-api/             # REST + Kafka producer (port 3001)
│  ├─ backend-persistence/     # Kafka consumer → Postgres
│  ├─ backend-notification/    # Kafka consumer → WebSocket (port 3002)
│  └─ frontend/                # React app (served by Nginx)
├─ docker-compose.yml
├─ docs/postman/videri-alert-flow.postman_collection.json
└─ README.md
```

## Operations Cheatsheet

- Dev compose: `docker compose --env-file .env.dev up --build`
- Prod-ish compose: `docker compose --env-file .env.prod up --build -d`
- Tail logs: `docker compose logs -f`
- Scale consumers: `docker compose up --scale backend-persistence=3 --scale backend-notification=3`

## Postman Collection

Import the collection at [docs/postman/videri-alert-flow.postman_collection.json](docs/postman/videri-alert-flow.postman_collection.json). It includes env values for base URL, superadmin headers, JWTs, and sample create/update payloads.

Included scopes:

- Health
- Auth
- Organizations (superadmin)
- Users (admin)
- Alerts (lifecycle and error scenarios)
- Error handling tests

## Troubleshooting

### Kafka & Events

- **EventProcessorService not publishing events**: Check `ALERT_EVENT_POLLING_INTERVAL_MS` is set and ProcessedEvent table is accessible. Verify Kafka broker connectivity.
- **Empty events in alert history**: Ensure backend-persistence is running and eventData is being reconstructed from flattened Kafka messages. Check persistence service logs for `Alert event saved` messages.
- **Duplicate status updates in frontend**: Frontend deduplication only works if backend produces same eventId + status within 2 minutes. Check notification service logs for `Status update notification sent` entries.

### WebSocket & Real-time

- **API → DB**: Confirm `DB_HOST` is reachable (`db` in-compose) or use mapped host port (5438).
- **Kafka consumers idle**: Verify `KAFKA_BROKER` and consumer groups inside the Kafka container; check offset commits are working.
- **WebSocket not updating**: Ensure `REACT_APP_WS_URL` matches notification service; check backend-notification logs for client connections and event emissions; verify organization IDs match between alert and client.
- **Status badges flashing**: Indicates duplicate events reaching frontend. Check notification service deduplication Map (2-second window) and ProcessedEvent table for proper status tracking.

### Database

- **Schema sync issues**: Delete container and Docker volume to reset: `docker compose down -v && docker compose up`
- **ProcessedEvent constraint violations**: Check that unique index on eventId is not corrupted; truncate table if needed: `TRUNCATE processed_event CASCADE`
- **Performance**: Index alert queries on (orgId, alertId) if needed; ProcessedEvent queries on eventId and status are indexed

## Contributing

- Use TypeScript style across packages; run lint/format before opening PRs.
- Prefer conventional commits (`feat`, `fix`, `docs`, etc.).
- Update `packages/shared/src/index.ts` for shared exports and rebuild shared before dependent packages.

## Quick Demo

1. Start the stack and import the Postman collection from `docs/postman/videri-alert-flow.postman_collection.json`.
2. Create a dev environment in Postman (if not present) and set the base URL and JWT placeholders.
3. Create an organization (copy UUID) and create an Admin user for that org via the Superadmin requests.
4. Login as the Admin and exercise Alerts and Users requests; watch real-time updates via the frontend connected to the notification service.

![Sample dev parameter](docs/images/image.png)
![Create org](docs/images/image-1.png)
![Create first Admin](docs/images/image-2.png)
![Login page](docs/images/image-3.png)
![Alert form tab](docs/images/image-4.png)
![User form tab](docs/images/image-5.png)
