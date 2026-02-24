# Vederi Alert Flow - Microservices Architecture

A scalable microservices-based alert management system with real-time notifications.

## Project Structure

```
vederi-alert-flow/
├── packages/
│   ├── shared/                      # Shared library (entities, DTOs, enums)
│   │   ├── src/
│   │   │   ├── entities/            # TypeORM entities
│   │   │   ├── dto/                 # Data Transfer Objects
│   │   │   └── enums/               # Enumerations
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── backend-api/                 # API Service (Port 3001)
│   │   ├── src/
│   │   │   ├── main.ts              # Entry point
│   │   │   ├── app.module.ts
│   │   │   ├── organization/        # Organization module
│   │   │   ├── user/                # User module
│   │   │   ├── alert/               # Alert module + WebSocket gateway
│   │   │   └── kafka/               # Kafka producer
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── nest-cli.json
│   │
│   ├── backend-persistence/         # Persistence Service (No HTTP port)
│   │   ├── src/
│   │   │   ├── main.ts              # Entry point
│   │   │   └── persistence.service.ts  # Kafka consumer → DB
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── nest-cli.json
│   │
│   ├── backend-notification/        # Notification Service (No HTTP port)
│   │   ├── src/
│   │   │   ├── main.ts              # Entry point
│   │   │   ├── notification.service.ts  # Kafka consumer → WebSocket
│   │   │   └── alert.gateway.ts     # WebSocket gateway
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── nest-cli.json
│   │
│   ├── frontend/                    # React Frontend (Port 80)
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── backend/                     # [DEPRECATED - Old monolithic backend]
│
├── docker-compose.yml               # Orchestrates all services
├── package.json                     # Root workspace config
├── .env.dev                         # Development environment variables
└── README.md
```

## Architecture Overview

### 1. Shared Library (`@vederi/shared`)

Common code used by all backend services:

- **Entities**: Organization, User, Alert, AlertEvent (TypeORM)
- **DTOs**: CreateAlertDto, UpdateAlertStatusDto, etc. (class-validator)
- **Enums**: AlertStatus (New/Acknowledged/Resolved)

**Dependencies**: TypeORM, class-validator

### 2. Backend API Service (`@vederi/backend-api`)

**Purpose**: REST API + WebSocket Gateway + Kafka Producer

**REST Endpoints**:

- `POST /organizations` - Create organization
- `GET /organizations` - List organizations
- `POST /users` - Create user
- `GET /users` - List users
- `POST /alerts` - Create alert (emits WebSocket `newAlert`)
- `GET /alerts?orgId=xxx&status=yyy` - List alerts with filters
- `PATCH /alerts/:id/status` - Update alert status (sends to Kafka, emits WebSocket `alertStatusUpdate`)
- `GET /alerts/:id/events` - List events for alert

**WebSocket Events**:

- `joinOrg` - Client joins org room
- `newAlert` - Emitted when alert created
- `alertStatusUpdate` - Emitted when status changes
- `alertEvent` - Emitted by notification service

**Kafka Producer**:

- Sends alert events to `alert-events` topic

**Port**: 3001 (externally) → 3000 (internally)

**Dependencies**: `@vederi/shared`, NestJS, TypeORM, Socket.IO, KafkaJS

### 3. Backend Persistence Service (`@vederi/backend-persistence`)

**Purpose**: Kafka Consumer → Database Persistence

**Kafka Consumer**:

- **Consumer Group**: `alert-events-persistence-group`
- **Topic**: `alert-events`
- **Action**: Saves events to `alert_event` table in PostgreSQL

**No HTTP Interface** - Pure event processor

**Dependencies**: `@vederi/shared`, NestJS, TypeORM, KafkaJS

### 4. Backend Notification Service (`@vederi/backend-notification`)

**Purpose**: Kafka Consumer → WebSocket Notifications

**Kafka Consumer**:

- **Consumer Group**: `alert-events-notification-group`
- **Topic**: `alert-events`
- **Action**: Emits WebSocket `alertEvent` to connected clients

**WebSocket Gateway**: Shares the same Socket.IO instance with API service for real-time notifications

**No HTTP Interface** - Pure event processor

**Dependencies**: `@vederi/shared`, NestJS, Socket.IO, KafkaJS

### 5. Frontend (`frontend`)

React application with Socket.IO client for real-time updates.

**Port**: 80

## Quick Start

### Install Dependencies

```bash
# From root directory (installs all packages)
npm run install:all
```

### Build All Projects

```bash
npm run build:all
```

### Run with Docker (Recommended)

```bash
# Start all services (7 containers)
npm run docker:up

# Detached mode
npm run docker:up:detached

# View logs
npm run docker:logs

# View specific service logs
npm run docker:logs:api
npm run docker:logs:persistence
npm run docker:logs:notification

# Stop all services
npm run docker:down
```

### Development (Individual Services)

**Shared Library** (must build first):

```bash
cd packages/shared
npm install
npm run build
```

**API Service**:

```bash
cd packages/backend-api
npm install
npm run start:dev
# or from root: npm run dev:api
```

**Persistence Service**:

```bash
cd packages/backend-persistence
npm install
npm run start:dev
# or from root: npm run dev:persistence
```

**Notification Service**:

```bash
cd packages/backend-notification
npm install
npm run start:dev
# or from root: npm run dev:notification
```

**Frontend**:

```bash
cd packages/frontend
npm install
npm start
# or from root: npm run dev:frontend
```

## Docker Services

When running `docker compose up`, the following containers start:

1. **db** - PostgreSQL 15 (port 5438 → 5432)
2. **zookeeper** - Confluent Zookeeper 7.5.0 (port 2181)
3. **kafka** - Confluent Kafka 7.5.0 (port 9092)
4. **backend-api** - API Service (port 3001 → 3000)
5. **backend-persistence** - Persistence Service (no exposed port)
6. **backend-notification** - Notification Service (no exposed port)
7. **frontend** - React app with Nginx (port 80)

## Event Flow

### Creating an Alert

```
1. Client → POST /alerts (API Service)
2. API Service → Save to DB
3. API Service → Emit WebSocket newAlert (real-time)
4. Return saved alert to client
```

### Updating Alert Status

```
1. Client → PATCH /alerts/:id/status (API Service)
2. API Service → Update DB
3. API Service → Send event to Kafka (alert-events topic)
4. API Service → Emit WebSocket alertStatusUpdate (real-time)

   [Kafka Consumers process in parallel]

5a. Persistence Service → Consume event → Save to alert_event table
5b. Notification Service → Consume event → Emit WebSocket alertEvent

6. Client receives WebSocket notifications
```

## Benefits of This Architecture

✅ **Independent Scaling**

- Scale API based on request volume
- Scale persistence based on DB throughput
- Scale notification based on WebSocket connections

✅ **Independent Development**

- Each project has its own `package.json` and dependencies
- Build and test services individually
- Clear separation of concerns

✅ **Fault Isolation**

- Notification crash doesn't affect persistence
- Persistence crash doesn't affect notifications
- API remains available even if consumers fail

✅ **Independent Deployment**

- Update one service without touching others
- Zero-downtime deployments possible
- Version services independently

✅ **Shared Code Management**

- `@vederi/shared` eliminates code duplication
- Single source of truth for entities and DTOs
- Type safety across all services

## Environment Variables

Create a `.env.dev` file in the root:

```env
# Database
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASS=password
DB_NAME=vederi

# Kafka
KAFKA_BROKER=kafka:9092

# API
PORT=3001
```

## Monitoring

**Check running containers**:

```bash
docker ps
```

**View API logs**:

```bash
docker logs -f vederi-alert-flow-backend-api-1
```

**View Persistence logs**:

```bash
docker logs -f vederi-alert-flow-backend-persistence-1
```

**View Notification logs**:

```bash
docker logs -f vederi-alert-flow-backend-notification-1
```

**Check Kafka consumer groups**:

```bash
# Persistence consumer
docker exec vederi-alert-flow-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group alert-events-persistence-group \
  --describe

# Notification consumer
docker exec vederi-alert-flow-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group alert-events-notification-group \
  --describe
```

## Production Deployment

1. **Build shared library first**: `npm run build:shared`
2. **Build each service**: `npm run build:all`
3. **Use production env**: Create `.env.prod` with production values
4. **Deploy with Docker Compose** or **Kubernetes**

For Kubernetes:

- Create separate Deployments for each service
- Use HPA (Horizontal Pod Autoscaler) for each
- Add health check endpoints
- Use managed Kafka (AWS MSK, Confluent Cloud)

## Migration from Old Backend

The old monolithic `packages/backend` is **deprecated**. All functionality has been split into:

- `packages/shared` - Common code
- `packages/backend-api` - REST API + WebSocket + Producer
- `packages/backend-persistence` - Persistence consumer
- `packages/backend-notification` - Notification consumer

## Troubleshooting

**Services won't start**:

- Ensure Docker is running
- Check `.env.dev` exists
- Verify ports 80, 3001, 5438, 9092, 2181 are not in use

**Build fails**:

- Build shared library first: `npm run build:shared`
- Check `@vederi/shared` dependency path in package.json

**Kafka consumers not receiving messages**:

- Check Kafka is running: `docker ps | grep kafka`
- Verify topic exists: `docker exec kafka kafka-topics --list --bootstrap-server localhost:9092`
- Check consumer groups are subscribed

## Contributing

When adding new shared code:

1. Add to `packages/shared/src/`
2. Export from `packages/shared/src/index.ts`
3. Rebuild: `npm run build:shared`
4. Other services will automatically pick up changes

## License

UNLICENSED - Private project
