# Docker Deployment Guide

This document explains the Docker-based deployment setup for TradeMachine Server.

## Overview

The application is deployed using Docker containers with:
- **Zero-downtime deployments** via GitHub Actions
- **Automatic database migrations** with Prisma
- **Multi-layer caching** for fast builds
- **Security scanning** with Trivy
- **Health checks** and automatic rollback

## Deployment Environments

### Production
- **Host Path**: `/opt/Apps/TradeMachine/`
- **Container**: `prod_trademachine`
- **Port**: `3005`
- **Image Tag**: `main`
- **Docker Compose**: `docker-compose.prod.yml`

### Staging
- **Host Path**: `/opt/Apps/StagingTradeMachine/`
- **Container**: `staging_trademachine`
- **Port**: `3015`
- **Image Tag**: `staging`
- **Docker Compose**: `docker-compose.staging.yml`

## Key Files

### Environment Configuration
- `.env.prod.template` - Production environment template
- `.env.staging.template` - Staging environment template
- **Critical**: Use single quotes for complex passwords in .env files

### Docker Configuration
- `Dockerfile` - Multi-stage build (Node 20, security hardened)
- `docker-compose.prod.yml` - Production container config
- `docker-compose.staging.yml` - Staging container config
- `docker-init.sh` - Container initialization script

### GitHub Actions
- `.github/workflows/docker-build-and-deploy.yml` - Full CI/CD pipeline

## Environment Variables

### Critical Variables
```bash
# Database Connection
PG_HOST=localhost          # PostgreSQL host (container connects to host DB)
PG_USER=trader_dev        # Database user
PG_PASSWORD=...           # Database password
PG_DB=trade_machine       # Database name
DATABASE_URL=postgresql://... # Full connection string

# Application
NODE_ENV=production       # Runtime environment
APP_ENV=production        # Application environment
BASE_DIR=/app            # Container working directory (NOT host path)
IP=0.0.0.0               # Bind to all interfaces (required for Docker)
PORT=3005                # Application port (3005=prod, 3015=staging)

# Redis (with special character handling)
REDIS_IP=127.0.0.1       # Redis host
REDIS_PORT=6379          # Redis port
REDISPASS='complex_password_in_single_quotes'  # Use single quotes!

# Rollbar
ROLLBAR_ACCESS_TOKEN=... # Error tracking token
ROLLBAR_ENVIRONMENT=production  # Environment name
```

## Deployment Process

### Automatic Deployment
1. **Push to `main`** → Production deployment
2. **Push to `staging`** → Staging deployment
3. **Manual trigger** → Choose environment

### Manual Deployment
```bash
# Via GitHub Actions UI
1. Go to Actions → "Build and Deploy Docker Image"
2. Click "Run workflow"
3. Select branch and environment
4. Optionally add description
```

### Build Process
1. **Security Scan** - Trivy vulnerability scanning
2. **Docker Build** - Multi-stage build with caching
3. **Image Push** - Push to GitHub Container Registry
4. **Database Migration** - Automatic Prisma migrations
5. **Container Deploy** - Zero-downtime container replacement
6. **Health Check** - 90s health verification with rollback

## Troubleshooting

### Common Issues

**Redis Authentication Error**
```
ERROR: ERR invalid password
```
- **Fix**: Use single quotes around REDISPASS in .env file
- **Wrong**: `REDISPASS=password!@#$%`
- **Wrong**: `REDISPASS="password!@#$%"`
- **Correct**: `REDISPASS='password!@#$%'`

**Database Migration Permissions**
```
ERROR: permission denied to create extension "pgcrypto"
```
- **Fix**: Create extension as superuser:
```bash
sudo -u postgres psql trade_machine -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

**Container Connection Issues**
- Check `IP=0.0.0.0` in .env (not `127.0.0.1`)
- Verify `PG_HOST=localhost` and other PG_* variables
- Ensure nginx can reach container port

### Debugging Commands

**Check container status:**
```bash
docker ps
docker logs prod_trademachine
docker logs staging_trademachine
```

**Test database connection:**
```bash
docker run --rm --env-file .env --network host \
  ghcr.io/akosasante/trade-machine-server:main \
  npx prisma migrate status
```

**Manual migration:**
```bash
docker run --rm --env-file .env --network host \
  ghcr.io/akosasante/trade-machine-server:main \
  npx prisma migrate deploy
```

## Maintenance

### Adding Environment Variables
1. Update `.env.prod.template` and `.env.staging.template`
2. Update actual `.env` files on servers
3. Update `docker-compose.*.yml` if needed
4. Redeploy containers

### Database Migrations
- **Automatic**: Migrations run during deployment
- **Manual**: Use Docker command above
- **Conflict Resolution**: Use `npx prisma migrate resolve --applied <migration_name>`

### Cache Management
- **GitHub Actions Cache**: Automatic (7-day retention)
- **Registry Cache**: Stored in GHCR (unlimited)
- **Clear Cache**: Delete workflow runs or registry packages

### Security Updates
- **Base Image**: Dockerfile uses `node:20-slim` (auto-updated)
- **Dependencies**: Dependabot handles package updates
- **Vulnerabilities**: Trivy scanning blocks insecure builds

## Architecture Benefits

### vs PM2 (Previous)
✅ **Consistent Environment** - Same container everywhere
✅ **Zero-Downtime Deploys** - Health checks prevent downtime
✅ **Automatic Rollback** - Failed deployments auto-revert
✅ **Security Scanning** - Vulnerability detection
✅ **Resource Isolation** - Container boundaries
✅ **Easy Scaling** - Multiple containers if needed

### Performance
- **Build Time**: ~2-5 minutes (with cache)
- **Deploy Time**: ~3-5 minutes total
- **Cache Hit Rate**: 90%+ for unchanged code
- **Zero Downtime**: Health checks ensure continuity

## Future Enhancements

- **Horizontal Scaling**: Multiple containers behind load balancer
- **Rolling Updates**: Blue/green deployment strategy
- **Resource Limits**: CPU/memory constraints
- **Monitoring**: Prometheus metrics collection
- **Backup Integration**: Automated database backups