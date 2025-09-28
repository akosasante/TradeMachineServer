# TradeMachine Server

TypeScript backend server for the TradeMachine fantasy baseball trading platform.

## 🏗️ Architecture

- **Express.js** REST API with routing-controllers
- **Session-based authentication** with Redis storage
- **Dual ORM approach**: TypeORM (legacy) + Prisma (new)
- **Bull/Redis** job queues for emails and scheduled tasks
- **PostgreSQL** database with TypeORM migrations
- **Docker** development and deployment

## 🚀 Quick Start

### 1. **Start Shared Infrastructure** (Required First Step)

```bash
# In the TradeMachine root directory
cd ../
./start-infrastructure.sh
# or manually: docker-compose -f docker-compose.shared.yml up -d
```

This provides shared PostgreSQL and Redis services that match production versions.

### 2. **Environment Setup**

```bash
# Copy environment template (if not already done in parent directory)
cp ../.env.shared ../.env

# Install dependencies
npm install
```

### 3. **Start Development Server**

Choose one of these approaches:

#### **Option A: Docker Development** (Recommended - Full Dev/Prod Parity)
```bash
# Complete setup (infrastructure + dev environment)
make docker-full-setup

# Or step by step:
make docker-infrastructure-up  # Start PostgreSQL, Redis, monitoring
make docker-dev-up            # Start containerized dev server with hot reloading
```

#### **Option B: Modern Local Development** (Fast TypeScript execution)
```bash
# Ensure you have the right Node.js version
cat .tool-versions  # Check required versions

# Run database migrations (if needed)
make run-migration

# Fast TypeScript development with tsx (no compilation step)
make dev-tsx
```

#### **Option C: Traditional Local Development**
```bash
# Start development server with TypeScript compilation + hot reloading
make dev-server
```

## 🔧 Development Commands

### **Build & Serve**
```bash
make build          # Compile TypeScript + copy email templates
make serve          # Run production build
make dev-server     # Traditional dev with TypeScript compilation + hot reloading
make dev-tsx        # Modern dev with tsx (fast TypeScript execution, no compilation)
make debug-server   # Traditional debug with Node.js debugger
make debug-tsx      # Modern debug with tsx + debugger
```

### **Docker Development**
```bash
make docker-full-setup           # Complete setup: infrastructure + dev environment
make docker-infrastructure-up    # Start shared PostgreSQL, Redis, monitoring
make docker-infrastructure-down  # Stop shared infrastructure
make docker-dev-up              # Start Docker dev environment with hot reloading
make docker-dev-down            # Stop Docker dev environment
make docker-dev-logs            # Show logs from Docker dev environment
make docker-dev-shell           # Open shell in Docker dev container
make docker-dev-restart         # Restart Docker dev container
make docker-dev-rebuild         # Rebuild and restart Docker dev environment
make docker-prod-test           # Test production Docker build locally
```

### **Code Quality**
```bash
make lint           # Run ESLint
make lint-fix       # Auto-fix ESLint issues
make format         # Format with Prettier
make typecheck      # TypeScript type checking
make fullcheck      # Run all: lint-fix, typecheck, format, lint
```

### **Testing**
```bash
make test-unit         # Unit tests with logging prompts
make test-integration  # Integration tests with logging prompts
make test-local        # Both unit and integration tests
make test-watch        # Watch mode for tests
make test-file         # Test specific file (prompts for path)
make test-ci           # CI tests (silent, no logging)
```

### **Database Migrations** (TypeORM)
```bash
make generate-migration  # Create new migration (prompts for name)
make run-migration      # Apply pending migrations
make revert-migration   # Rollback last migration
```

## 🐳 Docker Development

### **Architecture**
- **App Container**: Runs on port 3001, connects to shared infrastructure
- **Shared PostgreSQL**: Accessible at `postgres:5432` internally, `localhost:5438` from host
- **Shared Redis**: Accessible at `redis:6379` internally, `localhost:6379` from host

### **Environment Variables**
The Docker setup uses environment variables from the parent directory's `.env` file:

```bash
# Database connection (shared across all microservices)
DATABASE_USER=trader_user
DATABASE_PASSWORD=your_secure_password
DATABASE_NAME=trade_dn

# Server configuration
PORT=3001
BASE_URL=http://localhost:3030  # Frontend URL for email templates
NODE_ENV=development
```

### **Volume Mounts** (Optimized for Performance)
- **Source code**: Selective bind mounts for hot reloading:
  - `./src:/app/src:cached` - Source files
  - `./prisma:/app/prisma:cached` - Database schema
  - `./tests:/app/tests:cached` - Test files
  - Configuration files (tsconfig.json, .env, etc.)
- **Node modules**: Named volume `/app/node_modules` (avoids cross-platform issues)
- **Excluded**: `/app/dist`, `/app/.git` (performance optimization)

### **Modern Features**
- **tsx execution**: Direct TypeScript execution with hot reloading (no compilation step)
- **Automatic migrations**: Database setup runs on container startup
- **Production testing**: `docker-compose --profile production up` for local prod testing
- **Smart volume strategy**: Faster file sync, better performance on macOS/Windows

## 🌐 Service Connectivity

### **Internal Service Discovery**
```bash
# From within the app container
postgres:5432    # Shared PostgreSQL database
redis:6379       # Shared Redis instance
```

### **External Access**
```bash
localhost:3001   # TradeMachine Server API
localhost:5438   # PostgreSQL database
localhost:6379   # Redis instance
localhost:3030   # TradeMachine Client (frontend)
```

## 📁 Project Structure

```
TradeMachineServer/
├── src/
│   ├── api/                 # Controllers and routes
│   ├── DAO/                 # Data access objects
│   │   ├── v2/             # Prisma DAOs (preferred)
│   │   └── *.ts            # TypeORM DAOs (legacy)
│   ├── models/             # TypeORM entities
│   ├── bootstrap/          # App initialization
│   └── authentication/     # Auth strategies
├── tests/
│   ├── unit/              # Unit tests
│   └── integration/       # Integration tests
├── prisma/
│   └── schema.prisma      # Prisma ORM schema
├── docker-compose.yml     # Development environment
├── Dockerfile             # Production container
├── Dockerfile.dev         # Development container (tsx hot reloading)
└── Makefile              # Development commands
```

## 🔄 Database Strategy

### **Current Migration: TypeORM → Prisma**
- **Legacy Code**: TypeORM entities in `/src/models/`
- **New Code**: Prisma schema in `/prisma/schema.prisma` with DAOs in `/src/DAO/v2/`
- **Rule**: All new development should use Prisma client

### **Development Workflow**
1. For existing features: Continue using TypeORM
2. For new features: Use Prisma with DAO pattern
3. Database migrations: Still handled by TypeORM until fully migrated

## 🔐 Authentication & Sessions

- **Session Management**: Redis-backed sessions with 7-day lifetime
- **Auth Strategy**: Secure, HTTP-only cookies
- **Protected Routes**: Use `@Authorized()` decorator with role-based access
- **Development**: `COOKIE_SECURE=false` for local development

## 📧 Background Jobs

### **Email System**
- **Queue**: Bull/Redis with exponential backoff (3 attempts, 30s base delay)
- **Templates**: Located in `src/email/templates/`
- **Transport**: SendInBlue/Brevo API integration

### **Scheduled Jobs**
- **ESPN Updates**: Daily at 2:22 AM ET
- **MLB Minor League**: Daily at 3:22 AM ET
- **Trade Notifications**: Real-time via Slack webhooks

## 🚦 Health Checks & Monitoring

### **Health Endpoint**
```bash
curl http://localhost:3001/health
```

### **Container Health**
- **Database**: `pg_isready` every 5 seconds
- **Redis**: `redis-cli ping` every 5 seconds
- **App**: HTTP health check every 30 seconds

## 🔧 Troubleshooting

### **Database Connection Issues**
```bash
# Check shared infrastructure is running
cd ../ && docker-compose -f docker-compose.shared.yml ps

# Test database connection
docker exec -it $(docker ps -q -f name=postgres) psql -U trader_user -d trade_dn
```

### **Port Conflicts**
```bash
# Check if port 3001 is in use
sudo lsof -i :3001

# Stop conflicting services
docker-compose down
```

### **Container Logs**
```bash
# View server logs
docker-compose logs -f app

# View all infrastructure logs
cd ../ && docker-compose -f docker-compose.shared.yml logs -f
```

## 📊 Production Parity

### **Versions Match Production**
- **PostgreSQL**: 10.23 (shared infrastructure)
- **Redis**: 5.0.7 (shared infrastructure)
- **Node.js**: 16 (from Dockerfile)

### **Environment Configuration**
- **Development**: Port 3001, Docker Compose
- **Staging**: Port 3015, GitHub Container Registry
- **Production**: Port 3005, GitHub Container Registry

## 🎯 Next Steps

1. **Complete Prisma Migration**: Replace remaining TypeORM usage
2. **API Framework Migration**: Move away from routing-controllers
3. **Improve Test Coverage**: Expand unit and integration test suites
4. **Enhanced Monitoring**: Integrate with Prometheus/Grafana stack
5. **Security Hardening**: Implement rate limiting and request validation