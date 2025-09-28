# Base image, in this first stage, we transpile TypeScript to JavaScript
FROM node:20-slim AS build
ARG CACHBUSTER=1

# Set working directory
WORKDIR /app

# Install make and curl (needed for health check and utilities)
RUN apt-get update && apt-get install -y make curl

# Copy package files and install dependencies (leverage Docker layer caching)
COPY package*.json ./
RUN npm ci

# Copy all source files including Makefile and prisma schema
COPY . .

# Generate Prisma client first (this creates the TypeScript types needed for compilation)
RUN npx prisma generate

# Build TypeScript code using make
RUN make build

# Create production image
FROM node:20-slim AS production

# Create app directory
WORKDIR /app

# Install curl and PostgreSQL client for health checks and initialization
RUN apt-get update && apt-get install -y curl postgresql-client

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/ormconfig.js ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src/email/templates ./dist/email/templates

# Copy initialization script
COPY docker-init.sh /docker-init.sh
RUN chmod +x /docker-init.sh

# Generate Prisma client
RUN npx prisma generate

# Create non-root user for security
RUN groupadd -r app && useradd -r -g app app
RUN chown -R app:app /app
USER app

# Environment variables
ENV NODE_ENV=production
# Default port is 3000, but will be overridden by environment-specific settings:
# - Production: 3005
# - Staging: 3015
# - Development: 3001
ENV PORT=3000
ENV IP=0.0.0.0

# Expose port - this is just documentation, the actual port is defined at runtime
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Use initialization script as entrypoint
ENTRYPOINT ["/docker-init.sh"]

# Run command
CMD ["node", "-r", "dotenv/config", "./dist/server.js"]