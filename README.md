# Vederi Alert Flow

This monorepo contains two services:

- **frontend** (`packages/frontend`) – React + TypeScript user interface
- **backend** (`packages/backend`) – NestJS API with PostgreSQL

## Environment Configuration

Both frontend and backend use `.env` files for configuration:

### Backend (`.env`)

```
DB_HOST=db
DB_PORT=5432
DB_USER=postgres
DB_PASS=password
DB_NAME=vederi
PORT=3000
JWT_SECRET=supersecretkey
JWT_EXPIRES_IN=3600s
```

### Frontend (`.env`)

```
REACT_APP_API_URL=http://localhost:3000
```

See `.env.example` files in each package for templates.

## Docker Compose (local dev & production)

Run both services (plus a Postgres instance) with:

**Development:**

```bash
# from repo root - uses .env.dev
docker compose --env-file .env.dev up --build
```

**Production:**

```bash
# from repo root - uses .env.prod
# Update .env.prod with your production credentials first!
docker compose --env-file .env.prod up --build -d
```

- Frontend: `http://localhost` (port 80)
- Backend: `http://localhost:3000`
- PostgreSQL: exposed on host port 5432

## Building individually

### Backend

```bash
cd packages/backend
npm install
npm run build
```

### Frontend

```bash
cd packages/frontend
npm install
npm run build
```

## Notes

- Backend connects to the `db` service using TypeORM; credentials are loaded from `.env`.
- Frontend uses `REACT_APP_API_URL` env variable to determine backend API endpoint.
- Frontend Dockerfile uses nginx to serve the built static files.
- JWT secrets and database passwords should never be committed to git (`.env` is in `.gitignore`).

Feel free to adjust the compose file or Dockerfiles for your deployment requirements.
