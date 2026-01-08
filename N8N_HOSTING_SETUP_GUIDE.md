# n8n Hosting Setup Guide
## Deploy n8n on https://n8n.truercm.com

This guide provides step-by-step instructions for hosting n8n on your own domain with SSL.

---

## Table of Contents

1. [Server Requirements](#server-requirements)
2. [Initial Server Setup](#initial-server-setup)
3. [Install Node.js](#install-nodejs)
4. [Install n8n](#install-n8n)
5. [Configure n8n](#configure-n8n)
6. [Setup PM2 Process Manager](#setup-pm2-process-manager)
7. [Configure Nginx Reverse Proxy](#configure-nginx-reverse-proxy)
8. [Setup SSL Certificate](#setup-ssl-certificate)
9. [DNS Configuration](#dns-configuration)
10. [Testing & Verification](#testing--verification)
11. [Maintenance & Updates](#maintenance--updates)

---

## Server Requirements

### Minimum Requirements
- **OS**: Ubuntu 20.04 LTS or higher (recommended)
- **RAM**: 2GB minimum, 4GB recommended
- **CPU**: 2 cores minimum
- **Storage**: 20GB minimum
- **Network**: Static IP address

### Recommended Cloud Providers
- **AWS EC2**: t3.small or larger
- **DigitalOcean**: $12/month droplet
- **Google Cloud**: e2-small or larger
- **Azure**: B2s or larger
- **Linode**: 4GB plan

---

## Initial Server Setup

### Step 1: Access Your Server

```bash
# SSH into your server
ssh root@your-server-ip

# Or if using a non-root user
ssh username@your-server-ip
```

### Step 2: Update System

```bash
# Update package lists
sudo apt update

# Upgrade installed packages
sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git build-essential
```

### Step 3: Create n8n User (Optional but Recommended)

```bash
# Create a dedicated user for n8n
sudo adduser n8n

# Add user to sudo group
sudo usermod -aG sudo n8n

# Switch to n8n user
su - n8n
```

### Step 4: Configure Firewall

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP
sudo ufw allow 80/tcp

# Allow HTTPS
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

---

## Install Node.js

n8n requires Node.js 18.x or higher.

### Option 1: Using NodeSource Repository (Recommended)

```bash
# Download and run NodeSource setup script for Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v18.x.x
npm --version   # Should show 9.x.x or higher
```

### Option 2: Using NVM (Node Version Manager)

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Load NVM
source ~/.bashrc

# Install Node.js 18
nvm install 18

# Set as default
nvm use 18
nvm alias default 18

# Verify
node --version
```

---

## Install n8n

### Step 1: Install n8n Globally

```bash
# Install n8n
sudo npm install -g n8n

# Verify installation
n8n --version
```

### Step 2: Create n8n Configuration Directory

```bash
# Create directory for n8n data
mkdir -p ~/.n8n

# Set proper permissions
chmod 755 ~/.n8n
```

### Step 3: Configure n8n Environment Variables

Create a configuration file:

```bash
# Create environment file
sudo nano /etc/environment.d/n8n.conf
```

Add the following content:

```bash
# n8n Configuration
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=YourSecurePassword123!

# Host and Port
N8N_HOST=n8n.truercm.com
N8N_PORT=5678
N8N_PROTOCOL=https

# Webhook URL
WEBHOOK_URL=https://n8n.truercm.com/

# Execution Process
EXECUTIONS_PROCESS=main

# Timezone
GENERIC_TIMEZONE=America/Chicago

# Database (SQLite by default, can change to PostgreSQL/MySQL)
DB_TYPE=sqlite
DB_SQLITE_DATABASE=/home/n8n/.n8n/database.sqlite

# Security
N8N_ENCRYPTION_KEY=your-random-32-character-key-here

# Logging
N8N_LOG_LEVEL=info
N8N_LOG_OUTPUT=console,file
N8N_LOG_FILE_LOCATION=/var/log/n8n/
```

Or create a systemd environment file:

```bash
sudo nano /etc/n8n/n8n.env
```

---

## Setup PM2 Process Manager

PM2 keeps n8n running continuously and restarts it if it crashes.

### Step 1: Install PM2

```bash
# Install PM2 globally
sudo npm install -g pm2
```

### Step 2: Create PM2 Ecosystem File

```bash
# Create ecosystem file
nano ~/n8n-ecosystem.config.js
```

Add this configuration:

```javascript
module.exports = {
  apps: [
    {
      name: 'n8n',
      script: 'n8n',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        N8N_BASIC_AUTH_ACTIVE: 'true',
        N8N_BASIC_AUTH_USER: 'admin',
        N8N_BASIC_AUTH_PASSWORD: 'YourSecurePassword123!',
        N8N_HOST: 'n8n.truercm.com',
        N8N_PORT: '5678',
        N8N_PROTOCOL: 'https',
        WEBHOOK_URL: 'https://n8n.truercm.com/',
        GENERIC_TIMEZONE: 'America/Chicago',
        N8N_LOG_LEVEL: 'info'
      }
    }
  ]
};
```

### Step 3: Start n8n with PM2

```bash
# Start n8n using ecosystem file
pm2 start ~/n8n-ecosystem.config.js

# Or start directly
pm2 start n8n -- start \
  --tunnel \
  -n n8n

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup

# Follow the instruction provided by the command above
# It will give you a command to run with sudo
```

### Step 4: Manage n8n with PM2

```bash
# Check status
pm2 status

# View logs
pm2 logs n8n

# Restart n8n
pm2 restart n8n

# Stop n8n
pm2 stop n8n

# Monitor
pm2 monit
```

---

## Configure Nginx Reverse Proxy

Nginx will handle SSL and forward requests to n8n.

### Step 1: Install Nginx

```bash
# Install Nginx
sudo apt install -y nginx

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### Step 2: Create Nginx Configuration

```bash
# Create configuration file for n8n
sudo nano /etc/nginx/sites-available/n8n.truercm.com
```

Add this configuration:

```nginx
# Upstream definition
upstream n8n_backend {
    server 127.0.0.1:5678;
    keepalive 64;
}

# HTTP server (will redirect to HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name n8n.truercm.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name n8n.truercm.com;

    # SSL Certificate (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/n8n.truercm.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/n8n.truercm.com/privkey.pem;

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Logging
    access_log /var/log/nginx/n8n-access.log;
    error_log /var/log/nginx/n8n-error.log;

    # Max body size (for file uploads)
    client_max_body_size 50M;

    # Proxy settings
    location / {
        proxy_pass http://n8n_backend;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Timeouts
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        send_timeout 600;
        
        # Buffering
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }

    # Webhook endpoints
    location ~ ^/(webhook|webhook-test)/ {
        proxy_pass http://n8n_backend;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_read_timeout 600;
    }
}
```

### Step 3: Enable the Configuration

```bash
# Create symbolic link to enable site
sudo ln -s /etc/nginx/sites-available/n8n.truercm.com /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

---

## Setup SSL Certificate

Use Let's Encrypt for free SSL certificates.

### Step 1: Install Certbot

```bash
# Install Certbot and Nginx plugin
sudo apt install -y certbot python3-certbot-nginx
```

### Step 2: Obtain SSL Certificate

```bash
# Get certificate for your domain
sudo certbot --nginx -d n8n.truercm.com

# Follow the prompts:
# 1. Enter your email address
# 2. Agree to terms of service
# 3. Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

Certbot will automatically:
- Obtain the certificate
- Update your Nginx configuration
- Set up auto-renewal

### Step 3: Verify Auto-Renewal

```bash
# Test renewal process
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot.timer
```

### Step 4: Manual Renewal (if needed)

```bash
# Renew certificates manually
sudo certbot renew

# Reload Nginx after renewal
sudo systemctl reload nginx
```

---

## DNS Configuration

Point your domain to your server.

### Step 1: Get Your Server IP

```bash
# Find your server's public IP
curl ifconfig.me

# Or
ip addr show
```

### Step 2: Configure DNS Records

In your DNS provider (GoDaddy, Cloudflare, Route53, etc.), add:

```
Type: A
Name: n8n
Value: YOUR_SERVER_IP
TTL: 3600 (or Auto)
```

This creates: `n8n.truercm.com` → `YOUR_SERVER_IP`

### Step 3: Verify DNS Propagation

```bash
# Check DNS resolution
nslookup n8n.truercm.com

# Or use dig
dig n8n.truercm.com

# Or online tool
# https://dnschecker.org/
```

Wait 5-10 minutes for DNS to propagate globally.

---

## Testing & Verification

### Step 1: Check n8n is Running

```bash
# Check PM2 status
pm2 status

# Check n8n logs
pm2 logs n8n --lines 50

# Check if n8n is listening on port 5678
sudo netstat -tlnp | grep 5678
```

### Step 2: Check Nginx

```bash
# Check Nginx status
sudo systemctl status nginx

# Test Nginx configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/n8n-access.log
sudo tail -f /var/log/nginx/n8n-error.log
```

### Step 3: Access n8n

Open your browser and go to:
```
https://n8n.truercm.com
```

You should see:
- n8n login page (if basic auth is enabled)
- Or n8n welcome screen

### Step 4: Test Webhook

Create a test workflow with a webhook:
1. Create new workflow in n8n
2. Add Webhook node
3. Set path: `test`
4. Activate workflow
5. Test webhook:

```bash
curl -X POST https://n8n.truercm.com/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

---

## Maintenance & Updates

### Update n8n

```bash
# Stop n8n
pm2 stop n8n

# Update n8n globally
sudo npm update -g n8n

# Or reinstall specific version
sudo npm install -g n8n@latest

# Start n8n
pm2 start n8n

# Verify version
n8n --version
```

### Backup n8n Data

```bash
# Backup n8n directory
sudo tar -czf n8n-backup-$(date +%Y%m%d).tar.gz ~/.n8n/

# Move to safe location
sudo mv n8n-backup-*.tar.gz /var/backups/

# Keep only last 30 days
find /var/backups/ -name "n8n-backup-*.tar.gz" -mtime +30 -delete
```

### Monitor Logs

```bash
# PM2 logs
pm2 logs n8n

# Nginx access logs
sudo tail -f /var/log/nginx/n8n-access.log

# Nginx error logs
sudo tail -f /var/log/nginx/n8n-error.log

# System logs
sudo journalctl -u nginx -f
```

### Performance Monitoring

```bash
# Monitor with PM2
pm2 monit

# Check resource usage
htop

# Or
top
```

---

## Troubleshooting

### Issue 1: Cannot Access n8n

**Check:**
```bash
# 1. Is n8n running?
pm2 status

# 2. Is Nginx running?
sudo systemctl status nginx

# 3. Is firewall allowing traffic?
sudo ufw status

# 4. Check DNS
nslookup n8n.truercm.com

# 5. Check SSL certificate
sudo certbot certificates
```

### Issue 2: 502 Bad Gateway

**Solution:**
```bash
# Check if n8n is running
pm2 status

# Restart n8n
pm2 restart n8n

# Check Nginx configuration
sudo nginx -t

# Check logs
pm2 logs n8n
sudo tail -f /var/log/nginx/n8n-error.log
```

### Issue 3: Webhook Not Working

**Solution:**
1. Verify workflow is Active
2. Check webhook URL format
3. Check Nginx proxy configuration
4. Test directly:
   ```bash
   curl http://localhost:5678/webhook/test
   ```

### Issue 4: SSL Certificate Issues

**Solution:**
```bash
# Renew certificate
sudo certbot renew --force-renewal

# Check certificate status
sudo certbot certificates

# If expired, get new certificate
sudo certbot delete --cert-name n8n.truercm.com
sudo certbot --nginx -d n8n.truercm.com
```

---

## Security Best Practices

### 1. Enable Basic Authentication

Already configured in environment variables:
```bash
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=YourSecurePassword123!
```

### 2. Use Strong Encryption Key

```bash
# Generate random encryption key
openssl rand -base64 32

# Add to n8n environment
N8N_ENCRYPTION_KEY=generated-key-here
```

### 3. Limit Access by IP (Optional)

In Nginx configuration:
```nginx
location / {
    # Allow specific IPs
    allow 203.0.113.0/24;  # Your office IP
    deny all;
    
    proxy_pass http://n8n_backend;
    # ... rest of config
}
```

### 4. Regular Updates

```bash
# Schedule weekly updates
sudo crontab -e

# Add line:
0 2 * * 0 npm update -g n8n && pm2 restart n8n
```

### 5. Enable Fail2Ban

```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Configure for Nginx
sudo nano /etc/fail2ban/jail.local

# Add:
[nginx-http-auth]
enabled = true
filter = nginx-http-auth
port = http,https
logpath = /var/log/nginx/n8n-error.log
```

---

## Advanced Configuration

### Use PostgreSQL Instead of SQLite

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Create database
sudo -u postgres psql
CREATE DATABASE n8n;
CREATE USER n8n_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE n8n TO n8n_user;
\q

# Update n8n environment
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=localhost
DB_POSTGRESDB_PORT=5432
DB_POSTGRESDB_DATABASE=n8n
DB_POSTGRESDB_USER=n8n_user
DB_POSTGRESDB_PASSWORD=secure_password
```

### Setup SMTP for Email Notifications

```bash
# Add to n8n environment
N8N_EMAIL_MODE=smtp
N8N_SMTP_HOST=smtp.gmail.com
N8N_SMTP_PORT=587
N8N_SMTP_USER=your-email@gmail.com
N8N_SMTP_PASS=your-app-password
N8N_SMTP_SENDER=your-email@gmail.com
```

---

## Quick Reference

### Common Commands

```bash
# Start n8n
pm2 start n8n

# Stop n8n
pm2 stop n8n

# Restart n8n
pm2 restart n8n

# View logs
pm2 logs n8n

# Reload Nginx
sudo systemctl reload nginx

# Renew SSL
sudo certbot renew
```

### Important File Locations

```
n8n data: ~/.n8n/
n8n database: ~/.n8n/database.sqlite
Nginx config: /etc/nginx/sites-available/n8n.truercm.com
SSL certificates: /etc/letsencrypt/live/n8n.truercm.com/
Logs: /var/log/nginx/
```

### Access URLs

```
n8n UI: https://n8n.truercm.com
Webhook: https://n8n.truercm.com/webhook/your-path
API: https://n8n.truercm.com/api/v1/
```

---

**Setup Complete!** 🎉

Your n8n instance is now running at **https://n8n.truercm.com** with:
- ✅ SSL encryption (Let's Encrypt)
- ✅ Nginx reverse proxy
- ✅ PM2 process management
- ✅ Auto-restart on failure
- ✅ Auto-renewal of SSL certificates
- ✅ Basic authentication

**Next Steps:**
1. Login to n8n at https://n8n.truercm.com
2. Import your workflow
3. Configure credentials
4. Test webhook endpoints
5. Start automating!

---

**Document Version**: 1.0.0  
**Last Updated**: November 13, 2025  
**Status**: Production Ready ✅
