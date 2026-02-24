# Old Backend Removal

## Removed Folder

`packages/backend/` - Monolithic backend (DEPRECATED)

## Removal Date

February 23, 2026

## Reason

The monolithic backend has been split into three independent microservices:

1. **packages/backend-api/** - API Service (REST + WebSocket + Kafka Producer)
2. **packages/backend-persistence/** - Persistence Service (Kafka Consumer → Database)
3. **packages/backend-notification/** - Notification Service (Kafka Consumer → WebSocket)

All shared code moved to:

- **packages/shared/** - Common entities, DTOs, and enums

## What Was Migrated

### Entities

All TypeORM entities moved to `packages/shared/src/entities/`:

- Organization
- User
- Alert
- AlertEvent

### DTOs

All DTOs moved to `packages/shared/src/dto/`:

- CreateOrganizationDto
- CreateUserDto
- CreateAlertDto
- UpdateAlertStatusDto
- CreateAlertEventDto

### Enums

All enums moved to `packages/shared/src/enums/`:

- AlertStatus

### Modules

Split across microservices:

- **Organization Module** → `packages/backend-api/src/organization/`
- **User Module** → `packages/backend-api/src/user/`
- **Alert Module** → `packages/backend-api/src/alert/`
- **Kafka Producer** → `packages/backend-api/src/kafka/`
- **Event Persistence Service** → `packages/backend-persistence/src/`
- **Event Notification Service** → `packages/backend-notification/src/`

### Dockerfiles

- `packages/backend/Dockerfile` → `packages/backend-api/Dockerfile`
- `packages/backend/Dockerfile.persistence` → `packages/backend-persistence/Dockerfile`
- `packages/backend/Dockerfile.notification` → `packages/backend-notification/Dockerfile`

## Recovery

If you need to reference the old code:

1. Check git history: `git log --all --full-history -- packages/backend/`
2. Restore from git: `git checkout <commit-hash> -- packages/backend/`

## New Project Structure

```
vederi-alert-flow/
├── packages/
│   ├── shared/              ← NEW: Shared library
│   ├── backend-api/         ← NEW: API microservice
│   ├── backend-persistence/ ← NEW: Persistence microservice
│   ├── backend-notification/← NEW: Notification microservice
│   ├── frontend/            ← Unchanged
│   └── backend/             ← REMOVED (this folder)
```

## Benefits of New Structure

✅ Independent package.json files for each service
✅ Independent builds and deployments
✅ Separate Docker containers
✅ Independent scaling
✅ Fault isolation
✅ Shared code via @vederi/shared package
