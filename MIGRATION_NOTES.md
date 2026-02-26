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

# Consolidated documentation
