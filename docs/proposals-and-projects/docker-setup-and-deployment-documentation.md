# Docker Setup and Deployment Documentation

This document provides instructions for setting up, developing, and deploying the TradeMachine Server application using Docker.

## Table of Contents

1. [Local Development Setup](#local-development-setup)
2. [Understanding the Dockerfile](#understanding-the-dockerfile)
3. [Docker-Compose Configuration](#docker-compose-configuration)
4. [Deployment Process](#deployment-process)
5. [Environment Variables](#environment-variables)
6. [Troubleshooting](#troubleshooting)
7. [Advanced Usage](#advanced-usage)

## Local Development Setup

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- Git repository cloned locally

### Starting the Development Environment

1. Clone the repository:
   ```bash
   git clone https://github.com/akosasante/TradeMachineServer.git
   cd TradeMachineServer
   ```

2. Start the development environment:
   ```bash
   docker-compose up -d
   ```

3. View logs:
   ```bash
   docker-compose logs -f app
   ```

4. Access the application:
   - API Server: http://localhost:3000
   - You can now make changes to the code and the server will automatically reload

### Running Tests

To run tests inside the Docker container:

```bash
docker-compose exec app npm run test
```

To run specific tests:

```bash
docker-compose exec app npm run test-unit
docker-compose exec app npm run test-integration
```

### Stopping the Development Environment

```bash
docker-compose down
```

To completely remove volumes (including database data):

```bash
docker-compose down -v
```

## Understanding the Dockerfile

The Dockerfile uses a multi-stage build process to optimize the final image size and security:

### Build Stage

```dockerfile
FROM node:16-slim as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN make build
```

This stage:
- Uses Node.js 16 as the base image
- Installs all dependencies
- Builds the TypeScript code

### Production Stage

```dockerfile
FROM node:16-slim as production

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/ormconfig.js ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/email/templates ./dist/email/templates

RUN npx prisma generate

RUN groupadd -r app && useradd -r -g app app
RUN chown -R app:app /app
USER app

ENV NODE_ENV=production
ENV PORT=3000
ENV IP=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "-r", "dotenv/config", "./dist/server.js"]
```

This stage:
- Uses the same Node.js base image
- Installs only production dependencies
- Copies built files from the build stage
- Generates Prisma client
- Creates and switches to a non-root user for security
- Sets environment variables
- Exposes port 3000
- Adds a health check
- Defines the start command

## Docker-Compose Configuration

The `docker-compose.yml` file sets up three services:

### App Service

```yaml
app:
  build:
    context: .
    target: build
  ports:
    - "3000:3000"
  environment:
    - NODE_ENV=development
    - PORT=3000
    - IP=0.0.0.0
    - PG_USER=postgres
    - PG_PASSWORD=postgres
    - PG_DB=trade_machine
    - ORM_CONFIG=development
    - BASE_DIR=/app
    - REDIS_IP=redis
    - REDIS_PORT=6379
    - SESSION_SECRET=local_dev_secret
    - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/trade_machine?schema=dev
    - ENABLE_LOGS=true
  volumes:
    - ./:/app
    - /app/node_modules
  depends_on:
    - postgres
    - redis
  command: npm run dev-server
```

This service:
- Builds from the Dockerfile using the build target
- Maps port 3000 to the host
- Sets development environment variables
- Mounts the current directory to /app in the container
- Preserves node_modules using volume mounting
- Depends on PostgreSQL and Redis services
- Runs the development server command

### PostgreSQL Service

```yaml
postgres:
  image: postgres:14
  environment:
    - POSTGRES_USER=postgres
    - POSTGRES_PASSWORD=postgres
    - POSTGRES_DB=trade_machine
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U postgres"]
    interval: 10s
    timeout: 5s
    retries: 5
```

This service:
- Uses PostgreSQL 14
- Sets up database credentials
- Maps port 5432 to the host
- Uses a named volume for persistent data
- Includes a health check

### Redis Service

```yaml
redis:
  image: redis:6
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

This service:
- Uses Redis 6
- Maps port 6379 to the host
- Uses a named volume for persistent data
- Includes a health check

## Deployment Process

The deployment process is automated through GitHub Actions. Here's how it works:

### 1. Build and Publish Workflow

When code is pushed to the `main` or `staging` branches, the first workflow:

- Builds the Docker image
- Pushes it to GitHub Container Registry
- Tags it with the branch name, commit SHA, and 'latest'

### 2. Deploy Workflow

After the build workflow completes successfully:

- Determines the environment (production or staging) based on the branch
- Creates a `docker-compose.yml` file for the appropriate environment
- Transfers it to the server
- Runs database migrations
- Deploys and starts the container
- Verifies container health

### Manual Deployment

If needed, you can manually deploy the application:

1. Log in to the server:
   ```bash
   ssh user@server
   ```

2. Navigate to the application directory:
   ```bash
   cd /opt/Apps/TradeMachine  # For production
   # or
   cd /opt/Apps/StagingTradeMachine  # For staging
   ```

3. Pull the latest image:
   ```bash
   docker pull ghcr.io/akosasante/trademachineserver:main  # For production
   # or
   docker pull ghcr.io/akosasante/trademachineserver:staging  # For staging
   ```

4. Restart the container:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

## Environment Variables

The application requires several environment variables to function properly:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production`, `development`, `test` |
| `PORT` | Server port | `3000` |
| `IP` | Server IP address | `0.0.0.0` |
| `ORM_CONFIG` | ORM configuration name | `production`, `staging`, `development` |
| `BASE_DIR` | Base directory | `/app` |
| `DATABASE_URL` | Prisma database URL | `postgresql://user:pass@host:port/db?schema=public` |
| `REDIS_IP` | Redis host | `redis` or IP address |
| `REDIS_PORT` | Redis port | `6379` |
| `SESSION_SECRET` | Session encryption key | Random string |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDISPASS` | Redis password | None |
| `PG_USER` | PostgreSQL username | From DATABASE_URL |
| `PG_PASSWORD` | PostgreSQL password | From DATABASE_URL |
| `PG_DB` | PostgreSQL database name | From DATABASE_URL |
| `ROLLBAR_ACCESS_TOKEN` | Rollbar token | None |
| `ROLLBAR_ENVIRONMENT` | Rollbar environment | NODE_ENV |
| `ENABLE_LOGS` | Enable console logging | `true` in development |
| `DB_LOGS` | Enable database query logging | `false` |

## Troubleshooting

### Common Issues

#### Container Not Starting

Check the logs:

```bash
docker-compose logs app
```

Verify environment variables:

```bash
docker-compose config
```

#### Database Connection Issues

Verify the database is running:

```bash
docker-compose ps postgres
```

Check the connection inside the container:

```bash
docker-compose exec app npx prisma db pull
```

#### Redis Connection Issues

Verify Redis is running:

```bash
docker-compose ps redis
```

Test the connection:

```bash
docker-compose exec redis redis-cli ping
```

#### Container Health Check Failing

Check the health status:

```bash
docker inspect --format='{{json .State.Health}}' $(docker-compose ps -q app) | jq
```

### Debugging

To start the container in debug mode:

```bash
docker-compose run --service-ports app npm run debug-server
```

## Advanced Usage

### Custom Database Migrations

To run custom database migrations:

```bash
docker-compose exec app npx prisma migrate dev --name my_migration
```

### Accessing the Database Directly

```bash
docker-compose exec postgres psql -U postgres -d trade_machine
```

### Viewing Redis Data

```bash
docker-compose exec redis redis-cli
```

Then:

```
AUTH your_redis_password  # If configured
KEYS *
```

### Scaling in Production

For production environments, consider:

1. Using Docker Swarm or Kubernetes for orchestration
2. Setting up database replication for high availability
3. Configuring Redis Sentinel or Redis Cluster
4. Implementing a proper logging stack (ELK or similar)
5. Setting up comprehensive monitoring with Prometheus and Grafana