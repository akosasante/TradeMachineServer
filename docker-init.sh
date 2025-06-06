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
npx prisma migrate deploy

# If arguments are provided, start the application
if [ $# -gt 0 ]; then
    echo "Starting the application..."
    exec "$@"
else
    echo "Database initialization complete. Exiting initialization script."
    exit 0
fi