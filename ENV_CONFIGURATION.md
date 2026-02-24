# Environment Configuration Guide

This document explains the environment configuration for all services in the Vederi Alert Flow microservices architecture.

## Environment Files Overview

Each service has its own `.env.dev` and `.env.prod` files for development and production environments respectively.

```
vederi-alert-flow/
├── .env.dev                                    # Root - Docker Compose development
├── .env.prod                                   # Root - Docker Compose production
└── packages/
    ├── backend-api/
    │   ├── .env.dev                            # API service development
    │   └── .env.prod                           # API service production
    ├── backend-persistence/
    │   ├── .env.dev                            # Persistence service development
    │   └── .env.prod                           # Persistence service production
    ├── backend-notification/
    │   ├── .env.dev                            # Notification service development
    │   └── .env.prod                           # Notification service production
    └── frontend/
        ├── .env.dev                            # Frontend development
        └── .env.prod                           # Frontend production
```

## Service-Specific Environment Variables

### 1. Backend API Service

**Location**: `packages/backend-api/.env.dev` | `.env.prod`

**Variables**:

```env
NODE_ENV              # development | production
PORT                  # API service port (default: 3000)
DB_HOST               # PostgreSQL host
DB_PORT               # PostgreSQL port
DB_USER               # Database username
DB_PASS               # Database password
DB_NAME               # Database name
KAFKA_BROKER          # Kafka broker address (host:port)
LOG_LEVEL             # debug | info | warn | error
```

**Usage**:

- Runs REST API endpoints
- Manages WebSocket gateway
- Produces events to Kafka
- Full database access

---

### 2. Backend Persistence Service

**Location**: `packages/backend-persistence/.env.dev` | `.env.prod`

**Variables**:

```env
NODE_ENV                    # development | production
DB_HOST                     # PostgreSQL host
DB_PORT                     # PostgreSQL port
DB_USER                     # Database username
DB_PASS                     # Database password
DB_NAME                     # Database name
KAFKA_BROKER                # Kafka broker address
KAFKA_CONSUMER_GROUP        # Consumer group ID
KAFKA_CLIENT_ID             # Kafka client ID
KAFKA_TOPIC                 # Topic to consume from
LOG_LEVEL                   # debug | info | warn | error
```

**Usage**:

- Consumes events from Kafka
- Saves alert events to database
- No HTTP interface

---

### 3. Backend Notification Service

**Location**: `packages/backend-notification/.env.dev` | `.env.prod`

**Variables**:

```env
NODE_ENV                    # development | production
KAFKA_BROKER                # Kafka broker address
KAFKA_CONSUMER_GROUP        # Consumer group ID
KAFKA_CLIENT_ID             # Kafka client ID
KAFKA_TOPIC                 # Topic to consume from
WEBSOCKET_CORS_ORIGIN       # CORS origin for WebSocket
LOG_LEVEL                   # debug | info | warn | error
```

**Usage**:

- Consumes events from Kafka
- Emits WebSocket notifications
- No database access
- No HTTP interface

---

### 4. Frontend

**Location**: `packages/frontend/.env.dev` | `.env.prod`

**Variables**:

```env
REACT_APP_API_URL           # Backend API URL
REACT_APP_WS_URL            # WebSocket URL (usually same as API)
REACT_APP_ENV               # development | production
REACT_APP_ENABLE_DEBUG      # true | false
```

**Usage**:

- React application configuration
- All variables must start with `REACT_APP_`
- Built into bundle at compile time

---

### 5. Root (Docker Compose)

**Location**: `.env.dev` | `.env.prod`

**Variables**:

```env
DB_HOST                     # Database host (usually 'db' in Docker)
DB_PORT                     # Database port
DB_USER                     # Database username
DB_PASS                     # Database password
DB_NAME                     # Database name
KAFKA_BROKER                # Kafka broker address
PORT                        # External API port
NODE_ENV                    # development | production
```

**Usage**:

- Used by `docker-compose.yml`
- Shared across all Docker services
- Overrides service-specific env files when using Docker

## Usage Scenarios

### Scenario 1: Docker Compose Development

```bash
# Uses root .env.dev
docker compose --env-file .env.dev up --build
```

**What happens**:

- All services use variables from root `.env.dev`
- Database host is `db` (Docker service name)
- Kafka broker is `kafka:9092` (Docker service name)
- API exposed on port 3001

---

### Scenario 2: Docker Compose Production

```bash
# Uses root .env.prod
docker compose --env-file .env.prod up --build
```

**What happens**:

- All services use variables from root `.env.prod`
- Database host should be production DB
- Kafka broker should be production Kafka
- API exposed on port 3000

**⚠️ IMPORTANT**: Update `.env.prod` with real production credentials!

---

### Scenario 3: Local Development (Individual Services)

**Run API service locally**:

```bash
cd packages/backend-api
cp .env.dev .env
npm run start:dev
```

**Run Persistence service locally**:

```bash
cd packages/backend-persistence
cp .env.dev .env
npm run start:dev
```

**Run Notification service locally**:

```bash
cd packages/backend-notification
cp .env.dev .env
npm run start:dev
```

**Run Frontend locally**:

```bash
cd packages/frontend
cp .env.dev .env
npm start
```

**What happens**:

- Each service uses its own `.env` file
- Services connect to `localhost:5438` for DB (if running locally)
- Services connect to `localhost:9092` for Kafka
- More granular control over each service

---

## Environment Variable Priority

When using Docker Compose, the priority order is:

1. **Environment variables set in shell** (highest priority)
2. **docker-compose.yml `environment:` section**
3. **`--env-file` specified file** (e.g., `.env.dev`)
4. **Service-specific `.env` files** (lowest priority)

Example:

```bash
# This uses .env.dev and overrides DB_PASS
DB_PASS=secret123 docker compose --env-file .env.dev up
```

---

## Production Deployment Checklist

Before deploying to production, update **ALL** `.env.prod` files:

### ✅ Root `.env.prod`

- [ ] Set `DB_HOST` to production database hostname
- [ ] Set `DB_PASS` to secure password (min 16 chars)
- [ ] Set `KAFKA_BROKER` to production Kafka cluster
- [ ] Set `NODE_ENV=production`

### ✅ Backend API `.env.prod`

- [ ] Same database credentials as root
- [ ] Same Kafka broker as root
- [ ] Set `LOG_LEVEL=info` or `warn`

### ✅ Backend Persistence `.env.prod`

- [ ] Same database credentials as root
- [ ] Same Kafka broker as root
- [ ] Verify `KAFKA_CONSUMER_GROUP` is unique

### ✅ Backend Notification `.env.prod`

- [ ] Same Kafka broker as root
- [ ] Set `WEBSOCKET_CORS_ORIGIN` to production frontend URL
- [ ] Verify `KAFKA_CONSUMER_GROUP` is unique

### ✅ Frontend `.env.prod`

- [ ] Set `REACT_APP_API_URL` to production API URL
- [ ] Set `REACT_APP_WS_URL` to production API URL
- [ ] Set `REACT_APP_ENABLE_DEBUG=false`

---

## Security Best Practices

### 1. Never Commit Production Secrets

Add to `.gitignore`:

```gitignore
.env
.env.local
.env.prod
*.env.prod
```

Keep only `.env.dev` in version control with safe default values.

### 2. Use Secret Management

For production, use:

- **AWS Secrets Manager**
- **Azure Key Vault**
- **HashiCorp Vault**
- **Kubernetes Secrets**

### 3. Rotate Credentials Regularly

- Database passwords: every 90 days
- Kafka credentials: every 180 days
- JWT secrets: every 365 days

### 4. Principle of Least Privilege

Each service should have its own database user with minimal permissions:

**API Service**: Read/Write on `alert`, `organization`, `user` tables
**Persistence Service**: Write-only on `alert_event` table
**Notification Service**: No database access

---

## Troubleshooting

### Issue: Services can't connect to database

**Check**:

1. Is `DB_HOST` correct for your environment?
   - Docker: `db` (service name)
   - Local: `localhost`
   - Production: actual hostname
2. Is `DB_PORT` correct?
   - Docker internal: `5432`
   - Docker external: `5438`
   - Production: usually `5432`
3. Are credentials correct?

**Test database connection**:

```bash
# From host machine
psql -h localhost -p 5438 -U postgres -d vederi

# From Docker container
docker exec -it backend-api psql -h db -p 5432 -U postgres -d vederi
```

---

### Issue: Kafka consumers not receiving messages

**Check**:

1. Is `KAFKA_BROKER` correct?
   - Docker: `kafka:9092`
   - Local: `localhost:9092`
   - Production: actual broker address
2. Are consumer groups unique?
   - Persistence: `alert-events-persistence-group`
   - Notification: `alert-events-notification-group`
3. Is topic created?

**Verify consumer groups**:

```bash
docker exec kafka kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --list
```

---

### Issue: Frontend can't reach API

**Check**:

1. Is `REACT_APP_API_URL` correct?
   - Development: `http://localhost:3001`
   - Production: `https://api.your-domain.com`
2. Did you rebuild after changing `.env`?
   - React builds env vars into bundle
   - Must rebuild: `npm run build`
3. Is CORS enabled on API?

---

## Development Workflow

### Starting Development Environment

**Option A: All services with Docker**

```bash
docker compose --env-file .env.dev up --build
```

**Option B: Selective local development**

```bash
# Start infrastructure only
docker compose --env-file .env.dev up db kafka zookeeper

# Run API locally
cd packages/backend-api
cp .env.dev .env
npm run start:dev

# Run Persistence locally
cd packages/backend-persistence
cp .env.dev .env
npm run start:dev

# Run Notification locally
cd packages/backend-notification
cp .env.dev .env
npm run start:dev

# Run Frontend locally
cd packages/frontend
cp .env.dev .env
npm start
```

**Benefits of Option B**:

- Faster restart times
- Better debugging
- Hot reload works
- Direct log access

---

## Production Deployment

### Step 1: Update Production Environment Files

```bash
# Update all .env.prod files with real credentials
# DO NOT commit these files to version control
```

### Step 2: Deploy with Docker Compose

```bash
docker compose --env-file .env.prod up --build -d
```

### Step 3: Verify Services

```bash
# Check all containers are running
docker ps

# Check API health
curl http://your-api-url:3000

# Check logs
docker compose logs -f backend-api
docker compose logs -f backend-persistence
docker compose logs -f backend-notification
```

### Step 4: Monitor

- Database connections
- Kafka consumer lag
- WebSocket connection count
- API response times

---

## Environment Templates

### Template: .env.dev

```env
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5438
DB_USER=postgres
DB_PASS=password
DB_NAME=vederi
KAFKA_BROKER=localhost:9092
LOG_LEVEL=debug
```

### Template: .env.prod

```env
NODE_ENV=production
DB_HOST=REPLACE_WITH_PRODUCTION_HOST
DB_PORT=5432
DB_USER=REPLACE_WITH_PRODUCTION_USER
DB_PASS=REPLACE_WITH_SECURE_PASSWORD
DB_NAME=REPLACE_WITH_PRODUCTION_DB
KAFKA_BROKER=REPLACE_WITH_PRODUCTION_KAFKA
LOG_LEVEL=info
```

---

## Quick Reference

| Service      | Dev Port | Prod Port | Database      | Kafka        |
| ------------ | -------- | --------- | ------------- | ------------ |
| API          | 3001     | 3000      | ✅ Read/Write | ✅ Producer  |
| Persistence  | -        | -         | ✅ Write Only | ✅ Consumer  |
| Notification | -        | -         | ❌ No Access  | ✅ Consumer  |
| Frontend     | 3000     | 80        | ❌ No Access  | ❌ No Access |

---

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)
- [Create React App: Environment Variables](https://create-react-app.dev/docs/adding-custom-environment-variables/)
- [KafkaJS Configuration](https://kafka.js.org/docs/configuration)
- [TypeORM Configuration](https://typeorm.io/data-source-options)
