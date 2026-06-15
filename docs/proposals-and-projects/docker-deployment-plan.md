# Docker Deployment Plan for TradeMachine Server

This document outlines a plan to modernize the TradeMachine Server deployment process by containerizing the application with Docker and improving the CI/CD pipeline using GitHub Actions.

## Current State

The TradeMachine Server is a TypeScript/Node.js application with the following key components:

- **Backend Framework**: Express with routing-controllers
- **Database**: PostgreSQL with dual ORM approach (TypeORM legacy / Prisma new code)
- **Caching/Job Queue**: Redis with Bull queue for background jobs
- **Deployment**: PM2 process manager on a Digital Ocean server
- **CI/CD**: GitHub Actions for building, uploading artifacts, and deploying via SSH

The current deployment workflow:
1. Builds TypeScript code
2. Compresses build artifacts
3. Uploads to Digital Ocean server via SCP
4. Extracts files and restarts PM2 process

## Dockerization Plan

### 1. Docker Image Design

#### Dockerfile Structure

```dockerfile
# Base image, in this first stage, we transpile TypeScript to JavaScript
FROM node:16-slim as build

# Set working directory
WORKDIR /app

# Copy package files and install dependencies (leverage Docker layer caching)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript code
RUN make build

# Create production image
FROM node:16-slim as production

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/ormconfig.js ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/email/templates ./dist/email/templates

# Generate Prisma client
RUN npx prisma generate

# Create non-root user for security
RUN groupadd -r app && useradd -r -g app app
RUN chown -R app:app /app
USER app

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Run command
CMD ["node", "-r", "dotenv/config", "./dist/server.js"]
```

### 2. Docker Compose for Local Development

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      target: build
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=development
      - PORT=3001
      - IP=0.0.0.0
      - PG_USER=postgres
      - PG_PASSWORD=postgres
      - PG_DB=trade_machine
      - ORM_CONFIG=development
      - BASE_DIR=/app
      - REDIS_IP=redis
      - SESSION_SECRET=local_dev_secret
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/trade_machine?schema=dev
    volumes:
      - ./:/app
      - /app/node_modules
    depends_on:
      - postgres
      - redis
    command: make dev-server

  postgres:
    image: postgres:12
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=trade_machine
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:5
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 3. Production Container Configuration

For production, we'll need to consider:

1. **Secrets Management**: Using environment variables injected at runtime
2. **Persistent Storage**: For logs and any other data that needs to persist
3. **Network Isolation**: Proper network security for database and Redis connections
4. **Resource Limits**: Setting memory and CPU limits for containers
5. **Health Checks**: For container orchestration and monitoring

## GitHub Actions CI/CD Pipeline

### 1. Building and Publishing Docker Image

```yaml
name: Build and Publish Docker Image

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Notify Rollbar of deploy start
        uses: rollbar/github-deploy-action@2.1.2
        id: rollbar_pre_deploy
        with:
          environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
          version: ${{ github.sha }}
          status: "started"
          local_username: ${{ github.actor }}
        env:
          ROLLBAR_ACCESS_TOKEN: ${{ secrets.ROLLBAR_ACCESS_TOKEN }}
          ROLLBAR_USERNAME: "aaasante"

      - uses: docker/setup-buildx-action@v2

      - name: Login to GitHub Container Registry
        if: github.event_name != 'pull_request'
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=ref,event=branch
            type=sha,format=short
            type=semver,pattern={{version}}
            latest

      - name: Build and push Docker image
        uses: docker/build-push-action@v3
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: Notify Rollbar of build completion
        if: github.event_name != 'pull_request'
        uses: rollbar/github-deploy-action@2.1.2
        with:
          environment: ${{ github.ref == 'refs/heads/main' && 'production' || 'staging' }}
          version: ${{ github.sha }}
          status: "succeeded"
          local_username: ${{ github.actor }}
        env:
          ROLLBAR_ACCESS_TOKEN: ${{ secrets.ROLLBAR_ACCESS_TOKEN }}
          ROLLBAR_USERNAME: "aaasante"
          DEPLOY_ID: ${{ steps.rollbar_pre_deploy.outputs.deploy_id }}
```

### 2. Deployment Workflow

```yaml
name: Deploy Docker Image

on:
  workflow_run:
    workflows: ["Build and Publish Docker Image"]
    branches: [main, staging]
    types: [completed]
  # Manual trigger for feature branches
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'staging'
        type: choice
        options:
        - staging
        - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'success' || github.event_name == 'workflow_dispatch' }}
    strategy:
      matrix:
        include:
          # Staging deployment conditions
          - environment: staging
            condition: ${{ 
              (github.event.workflow_run.head_branch == 'staging') ||
              (github.event.workflow_run.head_branch == 'main') ||
              (github.event_name == 'workflow_dispatch' && github.event.inputs.environment == 'staging')
            }}
            app_dir: /opt/Apps/StagingTradeMachine
            image_tag: ${{ github.event.workflow_run.head_branch || github.ref_name }}
            port: 3001
          
          # Production deployment conditions  
          - environment: production
            condition: ${{ 
              (github.event.workflow_run.head_branch == 'main') ||
              (github.event_name == 'workflow_dispatch' && github.event.inputs.environment == 'production')
            }}
            app_dir: /opt/Apps/TradeMachine
            image_tag: main
            port: 3000

    steps:
      - name: Skip if condition not met
        if: ${{ !matrix.condition }}
        run: echo "Skipping ${{ matrix.environment }} deployment" && exit 0

      - name: Run database migrations for ${{ matrix.environment }}
        if: ${{ matrix.condition }}
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd ${{ matrix.app_dir }}
            source .env
            docker pull ghcr.io/${{ github.repository }}:${{ matrix.image_tag }}
            docker run --rm --env-file .env ghcr.io/${{ github.repository }}:${{ matrix.image_tag }} npx prisma migrate deploy

      - name: Deploy ${{ matrix.environment }}
        if: ${{ matrix.condition }}
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd ${{ matrix.app_dir }}
            
            # Update IMAGE_TAG in .env
            sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=${{ matrix.image_tag }}/' .env
            
            # Login to registry
            echo "${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            
            # Deploy
            docker-compose pull app
            docker-compose up -d app
            
            # Health check
            timeout=60
            while [ $timeout -gt 0 ]; do
              if curl -f http://localhost:${{ matrix.port }}/api/health; then
                echo "${{ matrix.environment }} deployment successful"
                exit 0
              fi
              sleep 5
              timeout=$((timeout-5))
            done
            
            echo "${{ matrix.environment }} health check failed"
            docker-compose logs app
            exit 1

      - name: Notify Rollbar of deployment
        if: ${{ matrix.condition }}
        uses: rollbar/github-deploy-action@2.1.2
        with:
          environment: ${{ matrix.environment }}
          version: ${{ github.sha }}
          status: "succeeded"
          local_username: ${{ github.actor }}
        env:
          ROLLBAR_ACCESS_TOKEN: ${{ secrets.ROLLBAR_ACCESS_TOKEN }}
          ROLLBAR_USERNAME: "aaasante"
```

## Deployment Strategy

### 1. Initial Setup

The deployment strategy uses static docker-compose files on the server with environment variables for dynamic configuration, avoiding the need to transfer compose files on every deployment.

#### Server Directory Structure
```
/opt/Apps/
├── TradeMachine/           # Production
│   ├── docker-compose.yml
│   └── .env
└── StagingTradeMachine/    # Staging  
    ├── docker-compose.yml
    └── .env
```

#### Static docker-compose.yml Files

**Staging** (`/opt/Apps/StagingTradeMachine/docker-compose.yml`):
```yaml
version: '3.8'

services:
  app:
    image: ghcr.io/${GITHUB_REPOSITORY}:${IMAGE_TAG}
    container_name: staging_trademachine
    restart: always
    env_file: .env
    ports:
      - "3001:3000"  # Staging on port 3001
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
```

**Production** (`/opt/Apps/TradeMachine/docker-compose.yml`):
```yaml
version: '3.8'

services:
  app:
    image: ghcr.io/${GITHUB_REPOSITORY}:${IMAGE_TAG}
    container_name: prod_trademachine
    restart: always
    env_file: .env
    ports:
      - "3000:3000"  # Production on port 3000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
```

#### Environment Files

Each directory has its own `.env` file with environment-specific configurations:

**Staging `.env`:**
```
IMAGE_TAG=staging
DATABASE_URL=postgresql://...staging_db
ENVIRONMENT=staging
NODE_ENV=production
PORT=3000
IP=0.0.0.0
ORM_CONFIG=staging
BASE_DIR=/app
REDIS_IP=...
REDIS_PORT=...
REDISPASS=...
SESSION_SECRET=...
ROLLBAR_ACCESS_TOKEN=...
ROLLBAR_ENVIRONMENT=staging
APP_ENV=staging
```

**Production `.env`:**
```
IMAGE_TAG=main
DATABASE_URL=postgresql://...prod_db
ENVIRONMENT=production
NODE_ENV=production
PORT=3000
IP=0.0.0.0
ORM_CONFIG=production
BASE_DIR=/app
REDIS_IP=...
REDIS_PORT=...
REDISPASS=...
SESSION_SECRET=...
ROLLBAR_ACCESS_TOKEN=...
ROLLBAR_ENVIRONMENT=production
APP_ENV=production
```

### 2. Deployment Logic

The deployment workflow now supports:

| Trigger | Staging Deploy | Production Deploy |
|---------|---------------|-------------------|
| Push to `staging` | ✅ | ❌ |
| Push to `main` | ✅ | ✅ |
| Manual trigger | ✅ (if selected) | ✅ (if selected) |
| Feature branch | ❌ (unless manual) | ❌ |

#### Manual Deployment for Feature Branches

For deploying feature branches to staging:
1. Go to GitHub Actions → "Deploy Docker Image" workflow
2. Click "Run workflow" 
3. Select "staging" environment
4. The workflow will build and deploy your current branch's image

#### Alternative: Comment-based Deployment

Optionally, you can add PR comment triggers:

```yaml
on:
  issue_comment:
    types: [created]

jobs:
  deploy-staging:
    if: contains(github.event.comment.body, '/deploy staging')
    # ... deploy logic using manual workflow_dispatch
```

Then comment `/deploy staging` on any PR to trigger a staging deployment.

### 3. Deployment Process

1. **Image Tag Update**: The workflow updates the `IMAGE_TAG` in the server's `.env` file
2. **Docker Pull**: Pulls the latest image for the specified tag
3. **Container Restart**: Uses `docker-compose up -d` to restart with the new image
4. **Health Check**: Verifies the application is responding on the correct port
5. **Database Migrations**: Runs automatically before deployment using a temporary container

### 2. Container Orchestration

While a single Docker container with docker-compose is sufficient initially, consider a more robust orchestration for the future:

- **Docker Swarm**: Simple cluster management built into Docker
- **Kubernetes**: For more complex scaling and management needs

### 3. High Availability Considerations

1. **Health Checks**: Configured in the container to enable automatic restarts
2. **Monitoring**: Set up container monitoring with Prometheus/Grafana
3. **Logging**: Configure centralized logging with ELK stack or similar
4. **Backup Strategy**: Regular database backups and container configuration backups

### 4. Scaling Strategy

1. **Horizontal Scaling**: Run multiple application containers behind a load balancer
2. **Database Scaling**: Consider read replicas for PostgreSQL
3. **Redis Cluster**: For scaling the job queue and session store

## Migration Plan

### Phase 1: Local Development Setup

1. Create the Dockerfile and docker-compose.yml
2. Test building and running the application locally
3. Update documentation for local development

### Phase 2: CI/CD Pipeline Setup

1. Create the GitHub Actions workflow for building and publishing the Docker image
2. Test the CI/CD pipeline with a feature branch
3. Verify the Docker image is correctly published to GitHub Container Registry

### Phase 3: Server Setup

1. Install Docker and docker-compose on the production server
2. Create the .env file with production secrets
3. Set up container monitoring and logging
4. Configure firewall and networking

### Phase 4: Production Deployment

1. Test the deployment workflow with the staging environment
2. Deploy to production using the new Docker-based workflow
3. Verify application functionality and performance
4. Switch DNS to the new Docker-based application

### Phase 5: Cleanup and Documentation

1. Remove the old deployment scripts and configurations
2. Update documentation for the new deployment process
3. Train team members on the new workflow

## Conclusion

Dockerizing the TradeMachine Server will provide several benefits:

1. **Consistent Environments**: Development, staging, and production will use the same container configuration
2. **Simplified Deployment**: Automated, reliable deployments with rollback capability
3. **Scalability**: Easier to scale horizontally as needed
4. **Portability**: Can be run on any infrastructure that supports Docker
5. **Security**: Improved isolation between application components

This plan outlines a gradual migration to a Docker-based workflow without disrupting the existing application.