# PostgreSQL and Redis Migration to Docker Plan

This document outlines the step-by-step process to migrate your existing host-based PostgreSQL and Redis services to Docker containers while ensuring no data loss.

## 1. Preparation

- [ ] Create backup directory
```bash
mkdir -p ~/database_migration_backups
```

- [ ] Check current PostgreSQL and Redis versions on host
```bash
psql --version
redis-cli info | grep version
```

## 2. PostgreSQL Migration

### 2.1 Backup PostgreSQL Data

- [ ] Create a full database dump
```bash
pg_dump -h localhost -U $PG_USER $PG_DB > ~/database_migration_backups/postgres_backup.sql
```

### 2.2 Update Docker Compose File

- [ ] Add PostgreSQL service to your docker-compose.staging.yml
```yaml
postgres:
  image: postgres:15  # Match your current version
  container_name: staging_postgres
  restart: always
  environment:
    - POSTGRES_PASSWORD=${PG_PASSWORD}
    - POSTGRES_USER=${PG_USER}
    - POSTGRES_DB=${PG_DB}
  volumes:
    - postgres_data:/var/lib/postgresql/data
  ports:
    - "5432:5432"
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${PG_USER} -d ${PG_DB}"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 10s
```

- [ ] Add volume definition
```yaml
volumes:
  postgres_data:
```

### 2.3 Update App Configuration

- [ ] Update app environment variables in docker-compose.staging.yml
```yaml
environment:
  # Existing environment variables...
  - PG_HOST=postgres  # Change from localhost to container service name
```

## 3. Redis Migration

### 3.1 Backup Redis Data

- [ ] Force a Redis save and copy RDB file
```bash
redis-cli SAVE
cp /var/lib/redis/dump.rdb ~/database_migration_backups/dump.rdb
```

### 3.2 Update Docker Compose File

- [ ] Add Redis service to your docker-compose.staging.yml
```yaml
redis:
  image: redis:7  # Match your current version
  container_name: staging_redis
  restart: always
  command: redis-server --appendonly yes
  volumes:
    - redis_data:/data
  ports:
    - "6379:6379"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 5s
    timeout: 3s
    retries: 5
    start_period: 10s
```

- [ ] Add volume definition (if not already added)
```yaml
volumes:
  redis_data:
```

### 3.3 Update App Configuration

- [ ] Update app environment variables in docker-compose.staging.yml
```yaml
environment:
  # Existing environment variables...
  - REDIS_HOST=redis  # Change from localhost to container service name
```

## 4. Service Dependencies

- [ ] Add service dependencies in docker-compose.staging.yml
```yaml
depends_on:
  postgres:
    condition: service_healthy
  redis:
    condition: service_healthy
```

## 5. Deployment and Data Restoration

### 5.1 Update Deployment Workflow

- [ ] Ensure your GitHub Actions deployment workflow pulls and starts all services
```yaml
# Update docker-deploy.yml
docker compose pull
docker compose up -d
```

### 5.2 Restore PostgreSQL Data (First Deployment Only)

- [ ] Connect to your server and restore the PostgreSQL data
```bash
cat ~/database_migration_backups/postgres_backup.sql | docker exec -i staging_postgres psql -U $PG_USER -d $PG_DB
```

### 5.3 Restore Redis Data (First Deployment Only, If Needed)

- [ ] Copy the Redis dump file to the container and restart Redis
```bash
docker cp ~/database_migration_backups/dump.rdb staging_redis:/data/dump.rdb
docker restart staging_redis
```

## 6. Verification

- [ ] Verify PostgreSQL data
```bash
docker exec -it staging_postgres psql -U $PG_USER -d $PG_DB -c 'SELECT COUNT(*) FROM users;'
```

- [ ] Verify Redis connection
```bash
docker exec -it staging_redis redis-cli ping
```

- [ ] Check application logs for database connection errors
```bash
docker logs staging_trademachine
```

## 7. Cleanup (After Successful Migration)

- [ ] Once everything is verified and working correctly, you can stop the host services
```bash
# Stop PostgreSQL on host (use appropriate command for your system)
sudo systemctl stop postgresql

# Stop Redis on host
sudo systemctl stop redis
```

- [ ] Keep backups for a reasonable period before removing them

## Notes

1. Ensure your environment variables in the `.env` file are correctly set
2. Consider a maintenance window for the migration to minimize disruption
3. The migration assumes your schemas and database users are properly configured
4. The docker-compose file assumes the .env file contains all necessary database credentials
5. Update your GitHub Actions workflows to include pulling and starting all services