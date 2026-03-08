# Database Migrations

## Adding Transactional Outbox Fields to AlertEvent

Since TypeORM is being used, you need to generate and run a migration to add the new fields to the `alert_event` table.

### Option 1: TypeORM CLI Migration (Recommended)

```bash
cd packages/backend-api

# Generate migration based on entity changes
npx typeorm migration:generate -d src/data-source.ts -n AddPublishedFieldsToAlertEvent

# Run the migration
npx typeorm migration:run -d src/data-source.ts
```

### Option 2: Manual SQL Migration

If TypeORM migration generation doesn't work, run this SQL directly:

```sql
-- Add published tracking fields to alert_event table
ALTER TABLE alert_event
ADD COLUMN published BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN published_at TIMESTAMP NULL,
ADD COLUMN publish_attempts INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN last_publish_error TEXT NULL;

-- Create index for efficient unpublished event queries
CREATE INDEX idx_alert_event_published_created_at
ON alert_event(published, created_at);

-- Mark existing events as published (they're already processed)
-- Option A: Mark all as published
UPDATE alert_event
SET published = true,
    published_at = created_at,
    publish_attempts = 1
WHERE id IS NOT NULL;

-- Option B: Leave unpublished to reprocess (safer but may cause duplicates)
-- Don't run any update - let processor handle republishing
-- Consumer services will deduplicate using ProcessedEvent table

-- Verify
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN published THEN 1 ELSE 0 END) as published_count,
  SUM(CASE WHEN NOT published THEN 1 ELSE 0 END) as unpublished_count
FROM alert_event;
```

### Option 3: TypeORM Synchronization (Development Only)

**WARNING**: Never use in production! This will drop and recreate tables.

```typescript
// In main.ts (development only)
const dataSource = new DataSource({
  type: "postgres",
  // ... other config
  synchronize: true, // ← Automatically syncs schema
});
```

## Migration Verification

After running migration:

```bash
# Check table structure
psql -h localhost -p 5438 -U vederi_user -d vederi_alert_flow -c "\d alert_event"

# Check unpublished events
psql -h localhost -p 5438 -U vederi_user -d vederi_alert_flow -c "SELECT COUNT(*) FROM alert_event WHERE published = false;"
```

## Rollback

If you need to rollback the migration:

```sql
-- Remove index
DROP INDEX IF EXISTS idx_alert_event_published_created_at;

-- Remove columns
ALTER TABLE alert_event
DROP COLUMN IF EXISTS published,
DROP COLUMN IF EXISTS published_at,
DROP COLUMN IF EXISTS publish_attempts,
DROP COLUMN IF EXISTS last_publish_error;
```
