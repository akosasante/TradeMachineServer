#!/bin/bash
set -e

echo "HIIIIIII3"
echo $DATABASE_URL
printenv

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
# Print DATABASE_URL for debugging (censored)
echo "Database URL for Prisma (censored): ${DATABASE_URL//:[^@]*@/:***@}"

# Create .env.prisma file with explicit DATABASE_URL to ensure Prisma can see it
echo "DATABASE_URL=\"$DATABASE_URL\"" > .env.prisma
echo "Created .env.prisma file:"
cat .env.prisma

# Run Prisma migrate with explicit .env file
npx prisma migrate deploy --env-file .env.prisma

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