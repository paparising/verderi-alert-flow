# Contributing to Vederi Alert Flow

Thank you for your interest in contributing!

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/vederi-alert-flow.git
   cd vederi-alert-flow
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Setup

### Local Development with Docker

```bash
docker compose --env-file .env.dev up --build
```

- Frontend: http://localhost
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5438

### Manual Setup

**Backend services:**

Build shared first, then run any service you need. Examples:

```bash
npm run build:shared

# API
cd packages/backend-api
npm install
npm run start:dev

# Persistence consumer
cd packages/backend-persistence
npm install
npm run start:dev

# Notification consumer
cd packages/backend-notification
npm install
npm run start:dev
```

**Frontend:**

```bash
cd packages/frontend
npm install
npm start
```

## Code Standards

- Use TypeScript for all code
- Follow ESLint configuration
- Format code with Prettier
- Write tests for new features

### Backend

Run commands in each service as needed (backend-api, backend-persistence, backend-notification). Shared: `npm run build:shared`.

### Frontend

```bash
cd packages/frontend
npm run test          # Run tests
```

## Commit Messages

Follow conventional commits:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `test:` for tests
- `refactor:` for refactoring
- `ci:` for CI/CD changes

Example:

```
feat: add JWT authentication
fix: resolve database connection timeout
docs: update README with setup instructions
```

## Pull Request Process

1. Keep PRs focused on a single feature or fix
2. Ensure all tests pass locally
3. Update documentation as needed
4. Reference any related issues
5. Provide clear description of changes

## Reporting Issues

Use GitHub Issues to report bugs or suggest features. Include:

- Clear description of the problem
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Screenshots/logs if applicable

## Code of Conduct

Be respectful, inclusive, and constructive in all interactions.

---

Questions? Open a discussion or issue on GitHub!
