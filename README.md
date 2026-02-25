# Vederi Alert Flow

This monorepo contains these services:

- **frontend** (`packages/frontend`) – React + TypeScript user interface
- **backend-api** (`packages/backend-api`) – REST API + WebSocket + Kafka producer
- **backend-persistence** (`packages/backend-persistence`) – Kafka consumer persisting events to Postgres
- **backend-notification** (`packages/backend-notification`) – Kafka consumer sending WebSocket notifications

## Environment Configuration

Both frontend and backend use `.env` files for configuration:

### Backend API (`packages/backend-api/.env`)

See `.env.dev` / `.env.prod` in each service for templates.

See `.env.example` files in each package for templates.

docker compose --env-file .env.dev up --build
docker compose --env-file .env.prod up --build -d

## Docker Compose (local dev & production)

Run the stack (frontend + 3 backend services + Postgres + Kafka + Zookeeper) with:

**Development:**

```bash
# from repo root - uses .env.dev
docker compose --env-file .env.dev up --build
```

**Production:**

```bash
# from repo root - uses .env.prod
docker compose --env-file .env.prod up --build -d
```

- Frontend: `http://localhost` (port 80)
- Backend API: `http://localhost:3003` (from .env.dev)
- PostgreSQL: exposed on host port 5438

## Building individually

```bash
npm run build:shared
npm run build:api:only
npm run build:persistence:only
npm run build:notification:only
```

## Notes

- Each backend service reads its own `.env.dev`/`.env.prod`.
- Frontend uses `REACT_APP_API_URL` env variable to determine backend API endpoint.
- JWT secrets and database passwords should never be committed to git (`.env` is in `.gitignore`).

Feel free to adjust the compose file or Dockerfiles for your deployment requirements.
