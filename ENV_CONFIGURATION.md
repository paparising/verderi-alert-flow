# Consolidated documentation

Configuration guidance now lives in the root README. Please see README.md for environment variables, compose usage, and per-service setup.

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
