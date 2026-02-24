# Kafka Integration for Alert Events

The alert system uses Apache Kafka with **two independent microservices** for event processing, following true microservices architecture principles.

## Microservices Architecture

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│   Client    │─────>│   Alert     │─────>│   Kafka     │
│   (REST)    │      │   Service   │      │  Producer   │
└─────────────┘      └─────────────┘      └─────────────┘
                            │                     │
                            │                     ▼
                            │              ┌─────────────┐
                            │              │   Kafka     │
                            │              │   Topic:    │
                            │              │ alert-events│
                            │              └─────────────┘
                            │                     │
                            │         ┌───────────┴───────────┐
                            │         │                       │
                            │         ▼                       ▼
                            │  ┌─────────────┐       ┌─────────────┐
                            │  │ Persistence │       │Notification │
                            │  │Microservice │       │Microservice │
                            │  │(Consumer 1) │       │(Consumer 2) │
                            │  └─────────────┘       └─────────────┘
                            │         │                       │
                            │         ▼                       ▼
                            │  ┌─────────────┐       ┌─────────────┐
                            └─>│  AlertEvent │       │  WebSocket  │
                               │  Database   │       │   Gateway   │
                               └─────────────┘       └─────────────┘
```

## Two Consumer Microservices

### 1. Event Persistence Service

- **Consumer Group**: `alert-events-persistence-group`
- **Responsibility**: Save events to database
- **Dependencies**: AlertEvent Repository
- **Failure Impact**: Events not persisted (can replay from Kafka)

### 2. Event Notification Service

- **Consumer Group**: `alert-events-notification-group`
- **Responsibility**: Send real-time WebSocket notifications
- **Dependencies**: WebSocket Gateway
- **Failure Impact**: Clients don't receive notifications (events still persisted)

## Flow

1. **Client updates alert status** via PATCH /alerts/:id/status
2. **AlertService** updates alert in database
3. **AlertService** sends event to Kafka via **KafkaProducerService**
4. **AlertService** emits WebSocket for alert status update (instant feedback)
5. Kafka broadcasts event to **both consumer groups**:
   - **Persistence Service** receives event → Saves to AlertEvent table
   - **Notification Service** receives event → Emits WebSocket to clients
6. Both services process **independently** and **in parallel**

## Benefits of Separated Microservices

✅ **Independent Scaling** - Scale persistence and notification services separately  
✅ **Fault Isolation** - Notification failure doesn't affect persistence (and vice versa)  
✅ **Single Responsibility** - Each service has ONE clear purpose  
✅ **Independent Deployment** - Update one service without affecting the other  
✅ **Technology Flexibility** - Could replace notification service with different tech (gRPC, email, etc.)  
✅ **Performance** - Both services process events in parallel  
✅ **Reliability** - If notifications fail, events are still persisted for later replay

## Components

### KafkaProducerService

**Location**: `packages/backend/src/kafka/kafka-producer.service.ts`

Sends alert events to Kafka topic `alert-events`:

```typescript
await kafkaProducer.sendAlertEvent("alert-events", {
  orgId: "org-uuid",
  eventId: "event-uuid",
  eventData: {
    alertId: "alert-uuid",
    previousStatus: "New",
    newStatus: "Acknowledged",
    changedAt: "2026-02-23T10:30:00.000Z",
  },
  createdBy: "user-uuid",
});
```

### KafkaConsumerService

**Location**: `packages/backend/src/kafka/kafka-consumer.service.ts`

Listens to `alert-events` topic and handles:

1. **Persists events to database** - Saves to AlertEvent table
2. **Emits WebSocket notifications** - Sends event to clients after successful persistence

- Consumer Group: `alert-events-group`
- Automatic reconnection on failure
- Error handling with logging (can extend with dead-letter queue)

**Benefits of WebSocket in Consumer**:

- ✅ **Consistency** - Notifications only sent after successful DB save
- ✅ **Decoupling** - AlerSends to Kafka instead of direct DB save
- `updateAlertStatus()` - Sends event to Kafka and emits WebSocket for alert status
- Simplified dependencies - No longer needs forwardRef for AlertGateway
- **WebSocket emissions**:
  - Alert status updates → Emitted in service (real-time)
  - Event notifications → Emitted in consumer (after persistence)ication is sent

### Updated AlertService

**Location**: `packages/backend/src/alert/alert.service.ts`

Changes:

- `createAlertEvent()` - Now sends to Kafka instead of direct DB save
- `updateAlertStatus()` - Sends event to Kafka after updating alert
- Still emits WebSocket events for real-time updates

## Configuration

### Environment Variables

**Backend `.env.dev`**:

```env
KAFKA_BROKER=kafka:9092
```

**Backend `.env.prod`**:

```env
KAFKA_BROKER=kafka:9092
```

### Docker Compose Services

**Zookeeper** (Kafka dependency):

- Port: 2181
- Image: confluentinc/cp-zookeeper:7.5.0

**Kafka**:

- Port: 9092
- Image: confluentinc/cp-kafka:7.5.0
- Broker ID: 1
- Replication Factor: 1 (increase for production)

## Testing

### 1. Start all services

```bash
docker compose --env-file .env.dev up --build
```

Wait for logs showing:

```
Kafka Producer connected
Kafka Consumer connected
Subscribed to alert-events topic
```

### 2. Create an alert

```bash
curl -X POST http://localhost:3001/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "your-org-id",
    "alertContext": "High CPU usage detected",
    "status": "New",
    "createdBy": "user-uuid"
  }'
```

### 3. Update alert status (triggers Kafka event)

```bash
curl -X PATCH http://localhost:3001/alerts/{alert-id}/status \
  -H "Content-Type: application/json" \
  -d '{
    "orgId": "your-org-id",
    "status": "Acknowledged",
    "updatedBy": "user-uuid"
  }'
```

### 4. Check backend logs

You should see:

```
WebSocket notification sent for event: {eventId}
Event sent to topic alert-events: {eventId}
Processing message from alert-events [0]: {eventId}
Alert event saved to database: {eventId}
```

### 5. Verify event in database

```sql
SELECT * FROM alert_event
WHERE event_data->>'alertId' = 'your-alert-id'
ORDER BY created_at DESC;
```

## Kafka Topic Details

### Topic: `alert-events`

**Message Schema**:

```json
{
  "orgId": "uuid",
  "eventId": "uuid",
  "eventData": {
    "alertId": "uuid",
    "previousStatus": "New|Acknowledged|Resolved",
    "newStatus": "New|Acknowledged|Resolved",
    "changedAt": "ISO8601 timestamp"
  },
  "createdBy": "uuid"
}
```

**Partitioning**: By `orgId` (message key)  
**Headers**: `timestamp` (ISO8601)

## Production Considerations

### 1. Increase Replication Factor

Update docker-compose.yml for production:

```yaml
KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 3
KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR: 3
```

### 2. Add Dead Letter Queue

Enhance consumer error handling:

```typescript
catch (error) {
  console.error('Error processing message:', error);
  await this.producer.send({
    topic: 'alert-events-dlq',
    messages: [{ value: message.value }]
  });
}
```

### 3. Enable Consumer Monitoring

Add health checks:

```typescript
@Get('/health/kafka')
async kafkaHealth() {
  return {
    producer: this.producer.connected,
    consumer: this.consumer.connected
  };
}
```

### 4. Adjust Consumer Group Config

```typescript
this.consumer = this.kafka.consumer({
  groupId: "alert-events-group",
  sessionTimeout: 30000,
  heartbeatInterval: 3000,
  maxWaitTimeInMs: 5000,
});
```

### 5. Use Multiple Kafka Brokers

```env
KAFKA_BROKER=kafka1:9092,kafka2:9092,kafka3:9092
```

## Monitoring

Check consumer group lag for **both services**:

**Persistence Service:**

```bash
docker exec vederi-alert-flow-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group alert-events-persistence-group \
  --describe
```

**Notification Service:**

```bash
docker exec vederi-alert-flow-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --group alert-events-notification-group \
  --describe
```

### Monitor Both Services

```bash
# Check both consumer groups at once
docker exec vederi-alert-flow-kafka-1 kafka-consumer-groups \
  --bootstrap-server localhost:9092 \
  --list
```

View topic messages (for debugging):

```bash
docker exec vederi-alert-flow-kafka-1 kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic alert-events \
  --from-beginning
```

## Troubleshooting

**Persistence Service not connecting:**

- Check logs: `docker logs vederi-alert-flow-backend-1 | grep "Persistence Service"`
- Verify database connection
- Check consumer group: `alert-events-persistence-group`

**Notification Service not connecting:**

- Check logs: `docker logs vederi-alert-flow-backend-1 | grep "Notification Service"`
- Verify WebSocket gateway is running
- Check consumer group: `alert-events-notification-group`

**Events persisted but no WebSocket notifications:**

- Notification service is down/failed (persistence still works!)
- Check WebSocket gateway connection
- Verify clients are connected to WebSocket

**WebSocket working but events not persisted:**

- Persistence service is down/failed (notifications still work!)
- Check database connection
- Verify AlertEvent table schema

**Both services failing:**

- Check Kafka broker: `docker logs vederi-alert-flow-kafka-1`
- Verify Zookeeper is running: `docker logs vederi-alert-flow-zookeeper-1`
- Ensure `KAFKA_BROKER` env var is set correctly

## Migration from Monolithic to Microservices

**Before** (Single consumer doing both):

```typescript
// Save to DB
await this.alertEventRepo.save(event);
// Emit WebSocket
this.alertGateway.emitAlertEvent(orgId, event);
```

**After** (Two independent microservices):

**Persistence Service:**

```typescript
// Only handles database
await this.alertEventRepo.save(event);
```

**Notification Service:**

```typescript
// Only handles WebSocket
this.alertGateway.emitAlertEvent(orgId, eventData);
```

### Benefits Summary:

1. **Fault Isolation** - One can fail without affecting the other
2. **Independent Scaling** - Scale based on specific bottleneck
3. **Clear Separation** - Each service has single responsibility
4. **Parallel Processing** - Both handle events simultaneously
5. **Future Flexibility** - Easy to add more notification channels (email, SMS)
