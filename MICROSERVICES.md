# Microservices Architecture - Separate Docker Containers

The backend has been split into **three independent microservices**, each running in its own Docker container.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Docker Compose                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  PostgreSQL  │  │  Zookeeper   │  │    Kafka     │            │
│  │  Container   │  │  Container   │  │  Container   │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                              │                      │
│         ┌────────────────────────────────────┼──────────────────┐  │
│         │                                    │                  │  │
│         ▼                                    ▼                  ▼  │
│  ┌─────────────┐                    ┌─────────────┐   ┌─────────────┐
│  │  Backend    │                    │  Backend    │   │  Backend    │
│  │    API      │───Kafka Topic─────>│ Persistence │   │Notification │
│  │ Microservice│     (Producer)     │Microservice │   │Microservice │
│  │  Container  │                    │ (Consumer1) │   │ (Consumer2) │
│  └─────────────┘                    └─────────────┘   └─────────────┘
│         │                                    │                  │  │
│         │ (REST API)                         │ (DB Writes)      │  │
│         │                                    ▼                  │  │
│         │                            ┌──────────────┐           │  │
│         │                            │  PostgreSQL  │           │  │
│         │                            │   Database   │           │  │
│         │                            └──────────────┘           │  │
│         │                                                       │  │
│         └─────────────────────────────────────────────────┬────┘  │
│                                                           │       │
│                                                    (WebSocket)    │
│                                                           │       │
│  ┌──────────────┐                                        │       │
│  │   Frontend   │◄───────────────────────────────────────┘       │
│  │  Container   │                                                │
│  └──────────────┘                                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

## Three Microservices

### 1. Backend API Service

**Container**: `backend-api`  
**Entry Point**: `src/main.ts`  
**Dockerfile**: `Dockerfile`  
**Port**: 3001 → 3000

**Responsibilities**:

- REST API endpoints (Organizations, Users, Alerts)
- WebSocket gateway for alert status updates
- Kafka producer (sends events)
- Business logic

**Dependencies**:

- PostgreSQL (for alerts, users, orgs)
- Kafka (producer only)

**Can scale based on**: API request volume

---

### 2. Backend Persistence Service

**Container**: `backend-persistence`  
**Entry Point**: `src/main-persistence.ts`  
**Dockerfile**: `Dockerfile.persistence`  
**Port**: None (no HTTP interface)

**Responsibilities**:

- Kafka consumer (listens to `alert-events` topic)
- Saves events to `alert_event` table
- Database persistence ONLY

**Dependencies**:

- PostgreSQL (for writing events)
- Kafka (consumer only)

**Can scale based on**: Database write throughput

---

### 3. Backend Notification Service

**Container**: `backend-notification`  
**Entry Point**: `src/main-notification.ts`  
**Dockerfile**: `Dockerfile.notification`  
**Port**: None (WebSocket through gateway)

**Responsibilities**:

- Kafka consumer (listens to `alert-events` topic)
- WebSocket notifications ONLY
- Real-time push to clients

**Dependencies**:

- Kafka (consumer only)
- WebSocket gateway

**Can scale based on**: Number of connected WebSocket clients

## Docker Compose Services

```yaml
services:
  backend-api: # REST API + Kafka Producer
  backend-persistence: # Event Persistence Consumer
  backend-notification: # Event Notification Consumer
  db: # PostgreSQL
  zookeeper: # Kafka dependency
  kafka: # Message broker
  frontend: # React app
```

## Starting the System

### All Services (Production-like)

```bash
docker compose --env-file .env.dev up --build
```

This starts **7 containers**:

- 1x Frontend
- 3x Backend services (API, Persistence, Notification)
- 1x PostgreSQL
- 1x Kafka
- 1x Zookeeper

### Individual Services (Development)

**API Service only:**

```bash
cd packages/backend
npm run start:dev
# or
npm run start:api
```

**Persistence Service only:**

```bash
cd packages/backend
npm run start:persistence
# or in production
npm run start:persistence:prod
```

**Notification Service only:**

```bash
cd packages/backend
npm run start:notification
# or in production
npm run start:notification:prod
```

## Scaling Strategies

### Scale Persistence Service (High DB Load)

```bash
docker compose up --scale backend-persistence=3
```

Runs 3 instances of persistence service, each consuming from the same consumer group.

### Scale Notification Service (Many Clients)

```bash
docker compose up --scale backend-notification=3
```

Runs 3 instances of notification service for more WebSocket connections.

### Scale API Service (High Traffic)

```bash
docker compose up --scale backend-api=3 -d
# Note: You'll need a load balancer in front
```

## Benefits of Separate Containers

✅ **Independent Scaling**

- Scale API based on request volume
- Scale persistence based on DB throughput
- Scale notifications based on connected clients

✅ **Fault Isolation**

- Notification crash doesn't affect API or persistence
- Persistence crash doesn't affect API or notifications
- API crash doesn't affect background event processing

✅ **Independent Deployment**

- Update notification logic without restarting API
- Update persistence logic without affecting other services
- Zero-downtime deployments possible

✅ **Resource Isolation**

- Each service gets its own CPU/memory limits
- Can allocate more resources to bottleneck service
- Better monitoring and debugging

✅ **Technology Flexibility**

- Could rewrite notification service in different language
- Could replace persistence with different storage
- Services only coupled through Kafka messages

## Monitoring

### Check Running Containers

```bash
docker ps
```

Should show:

- `vederi-alert-flow-backend-api-1`
- `vederi-alert-flow-backend-persistence-1`
- `vederi-alert-flow-backend-notification-1`
- Plus db, kafka, zookeeper, frontend

### View Logs per Service

**API Service:**

```bash
docker logs -f vederi-alert-flow-backend-api-1
```

**Persistence Service:**

```bash
docker logs -f vederi-alert-flow-backend-persistence-1
```

Look for: `[Persistence Service] Alert event saved to database`

**Notification Service:**

```bash
docker logs -f vederi-alert-flow-backend-notification-1
```

Look for: `[Notification Service] WebSocket notification sent`

### Health Checks

**API Service:**

```bash
curl http://localhost:3001
```

**Kafka Consumer Groups:**

```bash
# Check persistence consumer
docker exec vederi-alert-flow-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group alert-events-persistence-group \
  --describe

# Check notification consumer
docker exec vederi-alert-flow-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group alert-events-notification-group \
  --describe
```

## Resource Allocation

Add resource limits in `docker-compose.yml`:

```yaml
backend-api:
  deploy:
    resources:
      limits:
        cpus: "1.0"
        memory: 1G
      reservations:
        cpus: "0.5"
        memory: 512M

backend-persistence:
  deploy:
    resources:
      limits:
        cpus: "0.5"
        memory: 512M

backend-notification:
  deploy:
    resources:
      limits:
        cpus: "0.5"
        memory: 256M
```

## Development Workflow

### Working on API only:

1. Start dependencies: `docker compose up db kafka zookeeper`
2. Run API locally: `npm run start:dev`
3. API connects to Docker Kafka/DB

### Working on Persistence only:

1. Start dependencies: `docker compose up db kafka zookeeper backend-api`
2. Run persistence locally: `npm run start:persistence`
3. Test by creating alerts via API

### Working on Notification only:

1. Start dependencies: `docker compose up kafka zookeeper backend-api`
2. Run notification locally: `npm run start:notification`
3. Test by updating alert status via API

## Troubleshooting

**Service won't start:**

- Check dependencies are running: `docker ps`
- Check logs: `docker logs <container-name>`
- Ensure Kafka is ready before consumers start

**Persistence service not saving:**

- Check consumer group: `alert-events-persistence-group`
- Verify database connection
- Check topic has messages

**Notification service not emitting:**

- Check consumer group: `alert-events-notification-group`
- Verify WebSocket gateway is initialized
- Check clients are connected

**Consumer lag building up:**

- Scale the affected service: `docker compose up --scale backend-persistence=2`
- Check resource limits
- Monitor CPU/memory usage

## Network Configuration

All services communicate via Docker internal network:

- API → Kafka: `kafka:9092`
- Persistence → DB: `db:5432`
- Persistence → Kafka: `kafka:9092`
- Notification → Kafka: `kafka:9092`
- Frontend → API: `backend-api:3000`

External access:

- Frontend: http://localhost:80
- API: http://localhost:3001
- PostgreSQL: localhost:5438
- Kafka: localhost:9092

## Production Deployment

For production with Kubernetes:

1. Convert to K8s Deployments (3 separate deployments)
2. Use HPA (Horizontal Pod Autoscaler) for each service
3. Add Redis for WebSocket session sharing
4. Add load balancer for API service
5. Use managed Kafka (AWS MSK, Confluent Cloud)
6. Add health check endpoints to each service

Example scaling:

- API: 3-10 pods (based on traffic)
- Persistence: 2-5 pods (based on event volume)
- Notification: 1-3 pods (based on WebSocket connections)
