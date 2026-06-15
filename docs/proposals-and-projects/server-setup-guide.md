# Server Setup Guide for Docker Deployment

This guide outlines the steps needed to set up a server for Docker-based deployment of the TradeMachine Server.

## Prerequisites

- Ubuntu 22.04 LTS server
- SSH access with sudo privileges
- Domain name pointing to the server

## 1. Initial Server Setup

### Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### Set Up Firewall

```bash
sudo apt install -y ufw
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

### Install Basic Utilities

```bash
sudo apt install -y curl wget git htop tmux
```

## 2. Install Docker and Docker Compose

### Install Docker

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### Install Docker Compose

```bash
sudo apt install -y docker-compose-plugin
```

## 3. Application Directory Setup

### Create Application Directories

```bash
sudo mkdir -p /opt/Apps/TradeMachine
sudo mkdir -p /opt/Apps/StagingTradeMachine
```

### Set Permissions

```bash
sudo chown -R $USER:$USER /opt/Apps/TradeMachine
sudo chown -R $USER:$USER /opt/Apps/StagingTradeMachine
```

## 4. Environment Configuration

### Create Production Environment File

```bash
cd /opt/Apps/TradeMachine
touch .env
```

Add the following variables to the .env file (replace with actual values):

```
# Application settings
PORT=3000
NODE_ENV=production
ORM_CONFIG=production
BASE_DIR=/app
APP_ENV=production

# Database settings
DATABASE_URL=postgresql://username:password@host:port/trade_machine?schema=public
PG_USER=username
PG_PASSWORD=password
PG_DB=trade_machine

# Redis settings
REDIS_IP=localhost
REDIS_PORT=6379
REDISPASS=your_redis_password
SESSION_SECRET=your_session_secret

# External services
ROLLBAR_ACCESS_TOKEN=your_rollbar_token
ROLLBAR_ENVIRONMENT=production
```

### Create Staging Environment File

```bash
cd /opt/Apps/StagingTradeMachine
touch .env
```

Add similar variables with staging-specific values.

## 5. Setup PostgreSQL (if not using existing instance)

### Install PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
```

### Create Database and User

```bash
sudo -u postgres psql -c "CREATE DATABASE trade_machine;"
sudo -u postgres psql -c "CREATE USER tm_user WITH ENCRYPTED PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE trade_machine TO tm_user;"
```

### Setup Schemas

```bash
sudo -u postgres psql -d trade_machine -c "CREATE SCHEMA IF NOT EXISTS public;"
sudo -u postgres psql -d trade_machine -c "CREATE SCHEMA IF NOT EXISTS staging;"
sudo -u postgres psql -d trade_machine -c "GRANT ALL ON SCHEMA public TO tm_user;"
sudo -u postgres psql -d trade_machine -c "GRANT ALL ON SCHEMA staging TO tm_user;"
```

## 6. Setup Redis (if not using existing instance)

### Install Redis

```bash
sudo apt install -y redis-server
```

### Configure Redis

Edit the Redis configuration file to enable password authentication:

```bash
sudo nano /etc/redis/redis.conf
```

Find the `requirepass` line and set a password:

```
requirepass your_redis_password
```

Restart Redis:

```bash
sudo systemctl restart redis
```

## 7. Configure Nginx as Reverse Proxy

### Install Nginx

```bash
sudo apt install -y nginx
```

### Create Nginx Configuration

For production:

```bash
sudo nano /etc/nginx/sites-available/trademachine
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name api.trades.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

For staging:

```bash
sudo nano /etc/nginx/sites-available/staging-trademachine
```

Add similar configuration with different server_name.

### Enable the Configurations

```bash
sudo ln -s /etc/nginx/sites-available/trademachine /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/staging-trademachine /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Set Up SSL with Certbot

### Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### Obtain SSL Certificates

For production:

```bash
sudo certbot --nginx -d api.trades.example.com
```

For staging:

```bash
sudo certbot --nginx -d staging-api.trades.example.com
```

## 9. Set Up Regular Backups

### Create Backup Script

```bash
touch /opt/Apps/backup-db.sh
chmod +x /opt/Apps/backup-db.sh
```

Add the following content:

```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/opt/Apps/backups"
DB_NAME="trade_machine"
SCHEMA=$1

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Backup database
pg_dump -h localhost -U tm_user -n $SCHEMA $DB_NAME > $BACKUP_DIR/${DB_NAME}_${SCHEMA}_${TIMESTAMP}.sql

# Compress backup
gzip $BACKUP_DIR/${DB_NAME}_${SCHEMA}_${TIMESTAMP}.sql

# Remove backups older than 15 days
find $BACKUP_DIR -name "${DB_NAME}_${SCHEMA}_*.sql.gz" -type f -mtime +15 -delete
```

### Schedule Regular Backups

```bash
crontab -e
```

Add the following lines:

```
# Backup production database daily at 2:00 AM
0 2 * * * /opt/Apps/backup-db.sh public

# Backup staging database daily at 3:00 AM
0 3 * * * /opt/Apps/backup-db.sh staging
```

## 10. Set Up Monitoring

### Install Prometheus and Node Exporter

```bash
sudo apt install -y prometheus prometheus-node-exporter
```

### Configure Prometheus

```bash
sudo nano /etc/prometheus/prometheus.yml
```

Add the following job to the `scrape_configs` section:

```yaml
  - job_name: 'trademachine'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['localhost:3000']
```

Restart Prometheus:

```bash
sudo systemctl restart prometheus
```

### Install Grafana

```bash
sudo apt-get install -y apt-transport-https
sudo apt-get install -y software-properties-common
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
echo "deb https://packages.grafana.com/oss/deb stable main" | sudo tee -a /etc/apt/sources.list.d/grafana.list
sudo apt-get update
sudo apt-get install -y grafana
sudo systemctl enable grafana-server
sudo systemctl start grafana-server
```

## 11. Test the Setup

### Test Nginx Configuration

```bash
curl -I https://api.trades.example.com
```

### Test Database Connection

```bash
docker run --rm --network host -e DATABASE_URL=postgresql://tm_user:your_password@localhost:5432/trade_machine?schema=public postgres:14 psql "$DATABASE_URL" -c "SELECT 1;"
```

### Test Redis Connection

```bash
docker run --rm --network host redis:6 redis-cli -h localhost -a your_redis_password ping
```

## 12. Security Recommendations

1. **Configure Automatic Updates**:
   ```bash
   sudo apt install -y unattended-upgrades
   sudo dpkg-reconfigure -plow unattended-upgrades
   ```

2. **Configure Fail2Ban**:
   ```bash
   sudo apt install -y fail2ban
   sudo systemctl enable fail2ban
   sudo systemctl start fail2ban
   ```

3. **Set Up SSH Key Authentication Only**:
   ```bash
   sudo nano /etc/ssh/sshd_config
   ```
   Set `PasswordAuthentication no` and restart SSH:
   ```bash
   sudo systemctl restart sshd
   ```

4. **Secure Docker**:
   - Limit container resources
   - Use Docker secrets for sensitive data
   - Scan images for vulnerabilities:
     ```bash
     docker scan ghcr.io/yourusername/trade-machine:latest
     ```

## 13. Troubleshooting

### Checking Container Logs

```bash
cd /opt/Apps/TradeMachine
docker-compose logs -f app
```

### Checking Nginx Logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Checking Container Health

```bash
cd /opt/Apps/TradeMachine
docker-compose ps
docker inspect $(docker-compose ps -q app) | grep -A 10 Health
```

### Restarting Services

```bash
# Restart the application container
cd /opt/Apps/TradeMachine
docker-compose restart app

# Restart Nginx
sudo systemctl restart nginx

# Restart PostgreSQL
sudo systemctl restart postgresql

# Restart Redis
sudo systemctl restart redis
```