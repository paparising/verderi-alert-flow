# Transactional Outbox Pattern - Event Publishing Guarantee

## Problem Statement

**Critical Issue**: If `alert.service` creates an `AlertEvent` in the database but the `AlertEventProcessorService` fails or crashes before publishing it to Kafka, the event would never reach Kafka, causing data loss.

## Solution: Transactional Outbox Pattern

The Transactional Outbox Pattern guarantees **at-least-once delivery** of events to Kafka by:

1. Storing events in a database table (the "outbox") in the same transaction as business data
2. Marking events with a `published` flag (initially `false`)
3. A separate background processor polls for unpublished events and publishes them to Kafka
4. Events are marked as `published = true` only **after** successful Kafka publish
5. If the processor crashes, unpublished events remain in the database and will be processed on restart

## Implementation

### 1. AlertEvent Entity Changes

Added fields to track publishing state:

```typescript
@Entity()
export class AlertEvent {
  // ... existing fields ...

  // Transactional Outbox Pattern fields
  @Column({ type: "boolean", default: false })
  published: boolean; // True = successfully published to Kafka

  @Column({ type: "timestamp", nullable: true })
  publishedAt: Date; // When event was published

  @Column({ type: "int", default: 0 })
  publishAttempts: number; // Number of publish attempts (for monitoring)

  @Column({ type: "text", nullable: true })
  lastPublishError: string; // Last error message (for debugging)
}
```

**Database Migration Required**: Run migrations to add these columns to existing `alert_event` table.

### 2. AlertEventProcessorService Changes

The processor now:

#### **Queries Only Unpublished Events**

```typescript
const unpublishedEvents = await this.alertEventRepo.find({
  where: {
    published: false, // ← Only fetch unpublished events
  },
  order: {
    createdAt: "ASC",
  },
  take: 100,
});
```

#### **Publishes with Transaction**

```typescript
// Step 1: Publish to Kafka FIRST (outside transaction)
await this.kafkaProducer.sendAlertEvent("alert-events", kafkaEventData);

// Step 2: Mark as published (inside transaction)
await queryRunner.manager.update(
  AlertEvent,
  { id: event.id },
  {
    published: true,
    publishedAt: new Date(),
    publishAttempts: event.publishAttempts + 1,
    lastPublishError: null,
  },
);

await queryRunner.commitTransaction();
```

**Why publish FIRST, then update?**

- If Kafka publish fails, transaction rolls back, event stays unpublished ✓
- If database update fails after successful Kafka publish, event may be published twice (acceptable with idempotency on consumer side)
- This ensures **at-least-once delivery** (better than losing events)

#### **Tracks Failures**

If publishing fails, the event remains `published = false` but `publishAttempts` is incremented:

```typescript
catch (error) {
  await queryRunner.rollbackTransaction();

  // Update failure metrics (separate transaction)
  await errorQueryRunner.manager.update(
    AlertEvent,
    { id: event.id },
    {
      publishAttempts: event.publishAttempts + 1,
      lastPublishError: error.message,
    },
  );
}
```

### 3. Consumer-Side Idempotency (Unchanged)

The `ProcessedEvent` table on consumer services (persistence, notification) ensures **exactly-once processing**:

```typescript
// Check if event already processed
const existingProcessedEvent = await this.processedEventRepo.findOne({
  where: { eventId: eventData.eventId },
});

if (existingProcessedEvent) {
  console.log(`Event ${eventData.eventId} already processed, skipping`);
  return; // Skip duplicate
}
```

## Guarantees

### ✅ No Event Loss

- **Scenario**: Processor crashes after saving `AlertEvent` but before publishing to Kafka
- **Result**: Event remains `published = false` in database
- **Recovery**: On restart, processor finds unpublished events and publishes them

### ✅ At-Least-Once Delivery

- Events may be published to Kafka multiple times (rare, only if DB update fails after Kafka publish)
- Consumer services use `ProcessedEvent` table for idempotency (deduplicate on eventId)
- Result: Each event processed **exactly once** by consumers

### ✅ No Kafka Dependency on Write Path

- Creating alerts doesn't require Kafka to be running
- Alert creation writes to database only (always succeeds if DB is up)
- Background processor publishes asynchronously (resilient to Kafka downtime)

### ✅ Automatic Retry

- Processor runs every 1 second (configurable via `ALERT_EVENT_POLLING_INTERVAL_MS`)
- Failed publish attempts are automatically retried on next poll
- No manual intervention needed

## Monitoring & Operations

### Check Unpublished Events Count

```bash
# Via API endpoint (add to alert.controller.ts)
GET /alerts/_internal/unpublished-count

# Returns: { count: 5 }
```

Implementation:

```typescript
@Get('_internal/unpublished-count')
async getUnpublishedCount() {
  const count = await this.alertEventProcessorService.getUnpublishedEventCount();
  return { count };
}
```

### Check Failed Publish Attempts

```bash
# Events with 5+ failed attempts
GET /alerts/_internal/failed-publishes?maxAttempts=5

# Returns: [{ id, eventId, publishAttempts, lastPublishError, ... }]
```

Implementation:

```typescript
@Get('_internal/failed-publishes')
async getFailedPublishes(@Query('maxAttempts') maxAttempts: string) {
  const max = parseInt(maxAttempts || '5', 10);
  return this.alertEventProcessorService.getFailedPublishEvents(max);
}
```

### Manual Reprocessing

If events are stuck (e.g., Kafka was down for extended period):

```typescript
// Add endpoint to manually trigger processing
@Post('_internal/reprocess-events')
async reprocessEvents() {
  const count = await this.alertEventProcessorService.manuallyProcessEvents();
  return { processed: count };
}
```

### Alerting Thresholds

Set up alerts for:

1. **High Unpublished Event Count**: `unpublishedCount > 100`
   - Indicates processor falling behind or Kafka issues
2. **High Publish Attempt Count**: `publishAttempts > 10`
   - Indicates persistent Kafka connection issues
3. **Old Unpublished Events**: `published = false AND createdAt < NOW() - INTERVAL '5 minutes'`
   - Indicates processor stopped or severe issues

## Database Performance

### Index for Efficient Queries

Added index on `(published, createdAt)` for fast unpublished event queries:

```typescript
@Index(['published', 'createdAt'])
export class AlertEvent { ... }
```

This allows the processor to quickly find unpublished events without scanning entire table.

### Query Performance

```sql
-- Fast: Uses index on (published, createdAt)
SELECT * FROM alert_event
WHERE published = false
ORDER BY created_at ASC
LIMIT 100;
```

## Comparison: Before vs After

| Aspect               | Before (ProcessedEvent only)  | After (Transactional Outbox)             |
| -------------------- | ----------------------------- | ---------------------------------------- |
| **Event Loss Risk**  | High (if processor crashes)   | None (events in DB)                      |
| **Query Efficiency** | O(n) - check all events       | O(k) - check unpublished only            |
| **Monitoring**       | Complex (compare two tables)  | Simple (check published flag)            |
| **Debugging**        | Difficult (no error tracking) | Easy (publishAttempts, lastPublishError) |
| **Idempotency**      | ProcessedEvent table          | ProcessedEvent + published flag          |
| **Recovery**         | Manual intervention           | Automatic on restart                     |

## Testing

### Unit Tests

Test scenarios:

1. ✅ Successful publish marks event as published
2. ✅ Failed Kafka publish keeps event unpublished
3. ✅ Failed DB update after Kafka publish allows retry (at-least-once)
4. ✅ Publish attempts are correctly incremented
5. ✅ Error messages are captured in lastPublishError
6. ✅ Only unpublished events are fetched by processor
7. ✅ Manual reprocessing works correctly

### Integration Tests

Test scenarios:

1. Create alert → Verify AlertEvent created with `published = false`
2. Wait for processor → Verify event published to Kafka
3. Verify `published = true` after successful publish
4. Simulate Kafka failure → Verify event stays unpublished
5. Restore Kafka → Verify event published on next poll
6. Verify consumer idempotency (ProcessedEvent prevents duplicates)

## Migration Notes

### Existing Data

Existing `AlertEvent` records need migration:

```sql
-- Mark all existing events as published (they're already in Kafka)
UPDATE alert_event
SET published = true,
    published_at = created_at,
    publish_attempts = 1
WHERE published IS NULL OR published = false;

-- Or if you want to republish them all:
-- Leave them as published = false and let processor handle them
```

### Rollback Plan

If issues occur:

1. The processor still works with unpublished events
2. ProcessedEvent table ensures no duplicate processing
3. Worst case: republish events (consumers deduplicate)

## Best Practices

1. **Monitor unpublished event count** - Alert if > 100
2. **Monitor publish attempts** - Alert if any event has > 10 attempts
3. **Set Kafka retry config** - Configure KafkaProducer with retries
4. **Database backups** - Regular backups ensure no event loss
5. **Processor redundancy** - Run multiple instances (with proper locking if needed)
6. **Log aggregation** - Centralize logs for easier debugging

## Future Enhancements

### 1. Exponential Backoff

For events with multiple failures:

```typescript
const delayMs = Math.min(1000 * Math.pow(2, event.publishAttempts), 60000);
// Skip events that failed recently (within delay period)
if (
  event.publishAttempts > 0 &&
  Date.now() - event.updatedAt.getTime() < delayMs
) {
  continue;
}
```

### 2. Dead Letter Queue

Move events with > 20 attempts to a DLQ table:

```typescript
if (event.publishAttempts >= 20) {
  await this.moveToDeadLetterQueue(event);
}
```

### 3. Distributed Processor Lock

If running multiple processor instances, use Redis lock:

```typescript
const lock = await redisService.acquireLock("event-processor", 30);
if (lock) {
  try {
    await this.processEvents();
  } finally {
    await redisService.releaseLock("event-processor");
  }
}
```

## References

- [Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [Event-Driven Architecture Best Practices](https://docs.aws.amazon.com/prescriptive-guidance/latest/modernization-data-persistence/transactional-outbox.html)
- [Kafka Producer Idempotence](https://kafka.apache.org/documentation/#producerconfigs_enable.idempotence)
