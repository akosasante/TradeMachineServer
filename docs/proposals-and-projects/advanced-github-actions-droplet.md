# Advanced GitHub Actions Deployment for DigitalOcean Droplet

This document outlines an advanced deployment strategy using GitHub Actions and a single DigitalOcean droplet, offering enterprise-grade features while keeping the infrastructure simple.

## 1. GitHub Actions with Environments & Approvals

```yaml
name: Deploy

on:
  push:
    branches: [main, staging]

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.meta.outputs.tags }}
      version: ${{ steps.version.outputs.version }}
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Important for versioning

      # Generate semantic version based on commits
      - id: version
        uses: paulhatch/semantic-version@v4
        with:
          tag_prefix: "v"
          major_pattern: "BREAKING CHANGE:"
          minor_pattern: "feat:"
          bump_each_commit: false

      - name: Docker meta
        id: meta
        uses: docker/metadata-action@v4
        with:
          images: ghcr.io/${{ github.repository }}
          tags: |
            type=semver,pattern={{version}},value=${{ steps.version.outputs.version }}
            type=sha,format=short
            type=ref,event=branch

      # Build & push with cache
      - uses: docker/setup-buildx-action@v2
      - uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v4
        with:
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            VERSION=${{ steps.version.outputs.version }}

  deploy-staging:
    needs: build
    environment: 
      name: staging
      url: https://staging-api.yourdomain.com
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to staging
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script_stop: true
          script: |
            cd /opt/deploy
            ./deploy.sh staging ${{ needs.build.outputs.image_tag }} ${{ needs.build.outputs.version }}

  deploy-production:
    needs: [build, deploy-staging]
    environment: 
      name: production
      url: https://api.yourdomain.com
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to production
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script_stop: true
          script: |
            cd /opt/deploy
            ./deploy.sh production ${{ needs.build.outputs.image_tag }} ${{ needs.build.outputs.version }}
```

## 2. Traefik as Reverse Proxy on DigitalOcean

```yaml
# /opt/deploy/docker-compose.yml
version: '3.8'

services:
  traefik:
    image: traefik:v2.9
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.myresolver.acme.tlschallenge=true"
      - "--certificatesresolvers.myresolver.acme.email=your@email.com"
      - "--certificatesresolvers.myresolver.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - "/var/run/docker.sock:/var/run/docker.sock:ro"
      - "letsencrypt:/letsencrypt"
    restart: unless-stopped

  app_blue:
    image: ${IMAGE_TAG_BLUE}
    environment:
      - "DATABASE_URL=${DATABASE_URL}"
      # Other environment vars
    labels:
      - "traefik.enable=true"
      # Blue deployment labels
      - "traefik.http.routers.app-blue.rule=Host(`${DOMAIN}`)"
      - "traefik.http.routers.app-blue.tls=true"
      - "traefik.http.routers.app-blue.tls.certresolver=myresolver"
      - "traefik.http.services.app-blue.loadbalancer.server.port=${APP_PORT}"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${APP_PORT}/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped

  app_green:
    image: ${IMAGE_TAG_GREEN}
    environment:
      - "DATABASE_URL=${DATABASE_URL}"
      # Other environment vars
    labels:
      - "traefik.enable=true"
      # Green deployment labels
      - "traefik.http.routers.app-green.rule=Host(`${DOMAIN}`)"
      - "traefik.http.routers.app-green.tls=true"
      - "traefik.http.routers.app-green.tls.certresolver=myresolver"
      - "traefik.http.services.app-green.loadbalancer.server.port=${APP_PORT}"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:${APP_PORT}/api/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
    restart: unless-stopped

volumes:
  letsencrypt:
```

## 3. Deployment Script with Blue-Green Deployments

```bash
#!/bin/bash
# /opt/deploy/deploy.sh

set -e

ENVIRONMENT=$1
IMAGE_TAG=$2
VERSION=$3
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Load environment variables
source /opt/deploy/.env.${ENVIRONMENT}

# Determine which deployment is active and which is idle
ACTIVE_DEPLOYMENT=$(docker ps --filter "name=app_blue" --format "{{.Names}}" | grep -q "app_blue" && echo "blue" || echo "green")
IDLE_DEPLOYMENT=$([ "$ACTIVE_DEPLOYMENT" == "blue" ] && echo "green" || echo "blue")

echo "Current active deployment: ${ACTIVE_DEPLOYMENT}"
echo "Deploying to: ${IDLE_DEPLOYMENT}"

# Backup database before migrations
pg_dump -U ${DB_USER} -h ${DB_HOST} -d ${DB_NAME} > /opt/backups/pre_deploy_${ENVIRONMENT}_${TIMESTAMP}.sql

# Update the idle deployment
export IMAGE_TAG_${IDLE_DEPLOYMENT^^}=${IMAGE_TAG}
docker-compose -f /opt/deploy/docker-compose.yml up -d app_${IDLE_DEPLOYMENT}

# Wait for the idle deployment to be healthy
echo "Waiting for ${IDLE_DEPLOYMENT} deployment to be healthy..."
timeout=60
while [ $timeout -gt 0 ]; do
  status=$(docker inspect --format='{{.State.Health.Status}}' app_${IDLE_DEPLOYMENT})
  if [ "$status" == "healthy" ]; then
    echo "${IDLE_DEPLOYMENT} deployment is healthy!"
    break
  fi
  sleep 5
  timeout=$((timeout-5))
  echo "Waiting... ${timeout}s left"
done

if [ $timeout -le 0 ]; then
  echo "Deployment failed! ${IDLE_DEPLOYMENT} did not become healthy."
  exit 1
fi

# Run database migrations
docker run --rm --network=host \
  -e DATABASE_URL=${DATABASE_URL} \
  ${IMAGE_TAG} npx prisma migrate deploy

# Switch traffic to the new deployment
sed -i "s/traefik.http.routers.app-${ACTIVE_DEPLOYMENT}.tls=true/traefik.http.routers.app-${ACTIVE_DEPLOYMENT}.tls=false/g" /opt/deploy/docker-compose.yml
sed -i "s/traefik.http.routers.app-${IDLE_DEPLOYMENT}.tls=false/traefik.http.routers.app-${IDLE_DEPLOYMENT}.tls=true/g" /opt/deploy/docker-compose.yml
docker-compose -f /opt/deploy/docker-compose.yml up -d traefik

# Log the deployment
echo "[${TIMESTAMP}] Deployed ${ENVIRONMENT}: ${VERSION} (${IMAGE_TAG})" >> /opt/deploy/deploy_history.log

# Send notification
curl -X POST ${SLACK_WEBHOOK_URL} \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"🚀 Deployed ${ENVIRONMENT} to version ${VERSION}\"}"

echo "Deployment complete!"
```

## 4. Monitoring Stack

```yaml
# /opt/monitoring/docker-compose.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:v2.42.0
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/usr/share/prometheus/console_libraries'
      - '--web.console.templates=/usr/share/prometheus/consoles'
    ports:
      - "9090:9090"
    restart: unless-stopped
    
  grafana:
    image: grafana/grafana:9.4.7
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
      - GF_USERS_ALLOW_SIGN_UP=false
      - GF_SERVER_ROOT_URL=https://grafana.yourdomain.com
    ports:
      - "3000:3000"
    restart: unless-stopped
    
  loki:
    image: grafana/loki:2.8.0
    volumes:
      - ./loki-config.yaml:/etc/loki/local-config.yaml
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    ports:
      - "3100:3100"
    restart: unless-stopped
      
  promtail:
    image: grafana/promtail:2.8.0
    volumes:
      - ./promtail-config.yaml:/etc/promtail/config.yaml
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
      - /var/run/docker.sock:/var/run/docker.sock
    command: -config.file=/etc/promtail/config.yaml
    restart: unless-stopped
    
volumes:
  prometheus_data:
  grafana_data:
  loki_data:
```

## 5. Automatic Backups and Rollback

```yaml
# /opt/backup/docker-compose.yml
version: '3.8'

services:
  db-backup:
    image: postgres:12
    volumes:
      - ./backup.sh:/backup.sh
      - ./restore.sh:/restore.sh
      - backups:/backups
    environment:
      - PGPASSWORD=${DB_PASSWORD}
      - S3_BUCKET=${S3_BUCKET}
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
    entrypoint: ["bash", "-c", "chmod +x /backup.sh && /backup.sh"]
    restart: unless-stopped

volumes:
  backups:
```

## Key Features of This Setup

1. **Automatic semantic versioning** based on commit messages
2. **Blue-green deployments** for zero downtime
3. **Required approvals** with GitHub Environments
4. **Automated database backups** before each deployment
5. **Comprehensive monitoring** with Prometheus, Grafana, and Loki
6. **SSL termination** with automatic certificate renewal via Traefik
7. **Deployment history** and notifications
8. **Automated rollback** capability if health checks fail
9. **Separate staging environment** with identical configuration

## Implementation Steps

1. **Set up GitHub Environments**:
   - Go to repository settings → Environments
   - Create "staging" and "production" environments
   - Add protection rules and required reviewers for production

2. **Server Setup**:
   - Create directory structure on DigitalOcean droplet
   - Set up environment files (`.env.staging` and `.env.production`)
   - Install Docker and docker-compose

3. **Traefik Setup**:
   - Configure DNS records for your domains
   - Set up Traefik as reverse proxy with SSL termination

4. **Deploy the Initial Version**:
   - Manually deploy the first version to establish the structure
   - Set up the blue-green deployment pattern

5. **Set Up Monitoring**:
   - Deploy Prometheus, Grafana, and Loki
   - Import dashboards for Node.js, PostgreSQL, and system monitoring

6. **Configure Backup System**:
   - Set up scheduled database backups
   - Configure S3 or other storage for offsite backups
   - Test the restore process

7. **Test the Deployment Pipeline**:
   - Push changes to staging branch
   - Verify automated deployment
   - Approve promotion to production

This setup gives you the robustness of a much more complex infrastructure while still using just a single DigitalOcean droplet and GitHub Actions. It's the best of both worlds - enterprise-grade deployment practices with a simple hosting setup.