#!/bin/bash
set -e

# Wait for PostgreSQL to become available
echo "Waiting for PostgreSQL to start..."
until PGPASSWORD=$PG_PASSWORD psql -h "$PG_HOST" -U "$PG_USER" -d "$PG_DB" -c '\q'; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

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
    echo "Database and email initialization complete. Exiting initialization script."
    exit 0
fi