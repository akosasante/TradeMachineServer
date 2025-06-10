#!/bin/bash
set -e

# Wait for PostgreSQL to become available
echo "Waiting for PostgreSQL to start..."
until PGPASSWORD=$PG_PASSWORD psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c '\q'; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is up - executing database setup"

# Create dev schema if it doesn't exist
PGPASSWORD=$PG_PASSWORD psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "CREATE SCHEMA IF NOT EXISTS dev;"
echo "Schema 'dev' created or already exists"

# Create uuid extension if doesn't exist
PGPASSWORD=$PG_PASSWORD psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
echo "UUID extension created or already exists"

# Run Prisma migrations (if needed)
echo "Running Prisma migrations..."

# Generate Prisma client
npx prisma generate

# Check if _prisma_migrations table exists, if not create it
echo "Checking if Prisma migrations table exists..."
if ! PGPASSWORD=$PG_PASSWORD psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -t -c "SELECT to_regclass('${SCHEMA}._prisma_migrations');" | grep -q "_prisma_migrations"; then
  echo "Creating _prisma_migrations table..."
  PGPASSWORD=$PG_PASSWORD psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
    CREATE TABLE IF NOT EXISTS \"${SCHEMA}\"._prisma_migrations (
      id VARCHAR(36) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      finished_at TIMESTAMP WITH TIME ZONE,
      migration_name VARCHAR(255) NOT NULL,
      logs TEXT,
      rolled_back_at TIMESTAMP WITH TIME ZONE,
      started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      applied_steps_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (id)
    );
  "
  
  # Mark existing migrations as applied to establish baseline
  echo "Marking existing migrations as applied..."
  for migration in $(ls -1 /app/prisma/migrations | grep -v "migration_lock.toml"); do
    migration_name=$(basename "$migration")
    echo "Marking migration $migration_name as applied"
    PGPASSWORD=$PG_PASSWORD psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c "
      INSERT INTO \"${SCHEMA}\"._prisma_migrations 
        (id, checksum, migration_name, finished_at, started_at, applied_steps_count) 
      VALUES 
        (gen_random_uuid(), 'manually_added', '$migration_name', now(), now(), 1);
    "
  done
fi

# Run Prisma migrations
echo "Running Prisma migrations..."
DATABASE_URL="postgresql://trader_dev:blawrie13@localhost:5432/trade_machine?schema=staging&application_name=tm_server_staging" npx prisma migrate deploy

# Set up email templates directory for development environment
if [ "$NODE_ENV" = "development" ]; then
    echo "Setting up email template directories for development..."
    mkdir -p /app/dist/email
    if [ -d /app/src/email/templates ] && [ ! -d /app/dist/email/templates ]; then
        echo "Creating symbolic link from /app/src/email/templates to /app/dist/email/templates"
        ln -sf /app/src/email/templates /app/dist/email/templates
    fi
fi

# If arguments are provided, start the application
if [ $# -gt 0 ]; then
    echo "Starting the application..."
    exec "$@"
else
    echo "Database initialization complete. Exiting initialization script."
    exit 0
fi