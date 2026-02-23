# Row Level Security (RLS) Setup

This document explains how to enable Row Level Security (RLS) for the Alert and AlertEvent tables using PostgreSQL.

## Why RLS?

RLS ensures that users can only access data from their organization (`org_id`). Even if a user gains SQL access, they cannot query or modify data from other organizations.

## Enabling RLS

### Step 1: Connect to PostgreSQL

```bash
psql -h localhost -p 5438 -U postgres -d vederi
```

### Step 2: Run the RLS migration

Execute the SQL commands in `migrations/enable-rls.sql`:

```sql
-- Enable RLS for Alert table
ALTER TABLE alert ENABLE ROW LEVEL SECURITY;

-- Create policy for org_id isolation
CREATE POLICY alert_org_isolation ON alert
  USING (org_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

-- Enable RLS for AlertEvent table
ALTER TABLE alert_event ENABLE ROW LEVEL SECURITY;

-- Create policy for AlertEvent
CREATE POLICY alert_event_org_isolation ON alert_event
  USING (org_id = current_setting('app.current_org_id')::uuid)
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);
```

### Step 3: Set org_id context in application

Before querying alerts, set the organization context:

```typescript
// In AlertService or middleware
await queryRunner.query(`SET app.current_org_id = '${orgId}'`);
```

## Verification

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE tablename IN ('alert', 'alert_event');

-- Should show 't' (true) for rowsecurity column
```

## API Usage

All alert endpoints automatically filter by organization based on the organization context.

- `POST /alerts` – Create alert (org_id required in body)
- `GET /alerts/org/:orgId` – Get alerts for organization
- `GET /alerts/:id/:orgId` – Get specific alert
- `PUT /alerts/:id/:orgId/status` – Update alert status
- `POST /alerts/events` – Create alert event
- `GET /alerts/events/org/:orgId` – Get audit trail for organization

## Notes

- RLS policies use `current_setting('app.current_org_id')` to enforce isolation
- The application must set this value before each query
- PostgreSQL superusers (postgres role) can bypass RLS by default
- RLS works alongside standard column/row permissions

## See Also

- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
