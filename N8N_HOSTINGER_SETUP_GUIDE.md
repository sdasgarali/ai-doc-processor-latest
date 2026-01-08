# n8n Setup Guide for Hostinger Cloud
## Deploy n8n on n8n.neuraforz.com

**⚠️ IMPORTANT SECURITY NOTICE:**
Change your Hostinger password immediately after completing this setup, as credentials were shared in a public conversation.

---

## Prerequisites

- Hostinger Cloud VPS account
- Domain: neuraforz.com (with subdomain: n8n.neuraforz.com)
- Access to Hostinger control panel

---

## Step-by-Step Setup Guide

### Step 1: Access Hostinger Cloud Panel

1. Go to https://hpanel.hostinger.com/
2. Login with:
   - Email: mirzahabibbeg7@gmail.com
   - Password: **(Change immediately after setup!)**

3. Navigate to **VPS** section
4. Select your Cloud VPS instance

### Step 2: Access SSH Terminal

**Option A: Use Hostinger's Web Terminal**
1. In Hostinger panel, go to **VPS**
2. Click on your VPS instance
3. Click **SSH Access** or **Open Terminal**
4. Web terminal will open in browser

**Option B: Use SSH Client (Recommended)**
1. Get SSH credentials from Hostinger:
   - Go to VPS → SSH Access
   - Note your:
     - IP Address: (e.g., 192.xxx.xxx.xxx)
     - Port: (usually 22)
     - Username: (usually root)
     - Password: (from Hostinger panel)

2. Connect via SSH:
```bash
# Windows (PowerShell or Command Prompt)
ssh root@YOUR_SERVER_IP

# Mac/Linux (Terminal)
ssh root@YOUR_SERVER_IP

# Enter password when prompted
```

### Step 3: Initial Server Setup

Once connected to SSH, run these commands:

```bash
# Update system packages
apt update && apt upgrade -y

# Install essential packages
apt install -y curl wget git build-essential ufw

# Create n8n user (optional but recommended)
adduser n8n
usermod -aG sudo n8n

# Configure firewall
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
ufw status
```

### Step 4: Install Node.js

```bash
# Install Node.js 18.x (required for n8n)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installation
node --version   # Should show v18.x.x
npm --version    # Should show 9.x.x or higher
```

### Step 5: Install n8n

```bash
# Install n8n globally
npm install -g n8n

# Verify installation
n8n --version

# Create n8n directory
mkdir -p /root/.n8n
chmod 755 /root/.n8n
```

### Step 6: Install PM2 (Process Manager)

```bash
# Install PM2 globally
npm install -g pm2

# Verify installation
pm2 --version
```

### Step 7: Create n8n Configuration

Create PM2 ecosystem file:

```bash
# Create ecosystem file
nano ~/n8n-ecosystem.config.js
```

Add this configuration (copy-paste):

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
        N8N_BASIC_AUTH_PASSWORD: 'ChangeThisPassword123!',
        N8N_HOST: 'n8n.neuraforz.com',
        N8N_PORT: '5678',
        N8N_PROTOCOL: 'https',
        WEBHOOK_URL: 'https://n8n.neuraforz.com/',
        GENERIC_TIMEZONE: 'America/Chicago',
        N8N_LOG_LEVEL: 'info',
        N8N_ENCRYPTION_KEY: 'your-random-32-character-key-change-this'
      }
    }
  ]
};
```

Save and exit (Ctrl+X, then Y, then Enter)

Generate encryption key:
```bash
# Generate random encryption key
openssl rand -base64 32

# Copy the output and update it in the ecosystem file above
```

### Step 8: Start n8n with PM2

```bash
# Start n8n
pm2 start ~/n8n-ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command that PM2 suggests

# Check status
pm2 status

# View logs
pm2 logs n8n
```

### Step 9: Install and Configure Nginx

```bash
# Install Nginx
apt install -y nginx

# Start and enable Nginx
systemctl start nginx
systemctl enable nginx

# Check status
systemctl status nginx
```

Create Nginx configuration:

```bash
# Create configuration file
nano /etc/nginx/sites-available/n8n.neuraforz.com
```

Add this configuration:

```nginx
# Upstream definition
upstream n8n_backend {
    server 127.0.0.1:5678;
    keepalive 64;
}

# HTTP server (redirect to HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name n8n.neuraforz.com;

    # Temporary location for Let's Encrypt verification
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all other HTTP to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server (will be configured by Certbot)
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name n8n.neuraforz.com;

    # SSL certificates (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/n8n.neuraforz.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/n8n.neuraforz.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Logging
    access_log /var/log/nginx/n8n-access.log;
    error_log /var/log/nginx/n8n-error.log;

    # Max body size
    client_max_body_size 50M;

    # Proxy to n8n
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
        
        # Timeouts
        proxy_connect_timeout 600;
        proxy_send_timeout 600;
        proxy_read_timeout 600;
        
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

Save and exit (Ctrl+X, then Y, then Enter)

Enable the site:

```bash
# Create symbolic link
ln -s /etc/nginx/sites-available/n8n.neuraforz.com /etc/nginx/sites-enabled/

# Test Nginx configuration
nginx -t

# If test passes, reload Nginx
systemctl reload nginx
```

### Step 10: Configure DNS in Hostinger

1. Go back to Hostinger panel
2. Navigate to **Domains** → **neuraforz.com**
3. Click **DNS / Name Servers**
4. Add/Edit DNS record:
   ```
   Type: A
   Name: n8n (or n8n.neuraforz.com)
   Value: YOUR_VPS_IP_ADDRESS
   TTL: 3600 (or default)
   ```
5. Click **Add Record** or **Save**

**Get your VPS IP:**
```bash
# Run this on your server to get IP
curl ifconfig.me
```

Wait 5-10 minutes for DNS to propagate.

Verify DNS:
```bash
# On your local computer
nslookup n8n.neuraforz.com

# Or
ping n8n.neuraforz.com
```

### Step 11: Setup SSL Certificate (Let's Encrypt)

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
certbot --nginx -d n8n.neuraforz.com

# Follow the prompts:
# 1. Enter your email: mirzahabibbeg7@gmail.com
# 2. Agree to terms: Y
# 3. Share email: N (optional)
# 4. Redirect HTTP to HTTPS: 2 (Yes)

# Verify auto-renewal
certbot renew --dry-run
```

Certbot will:
- Automatically obtain SSL certificate
- Update Nginx configuration
- Setup auto-renewal

### Step 12: Test Your Installation

Open browser and go to:
```
https://n8n.neuraforz.com
```

You should see:
- n8n login page
- Login with:
  - Username: admin
  - Password: (the one you set in ecosystem config)

**If you see "Connection refused" or "Site can't be reached":**
1. Wait 5 more minutes (DNS propagation)
2. Check n8n is running: `pm2 status`
3. Check Nginx is running: `systemctl status nginx`
4. Check firewall: `ufw status`

### Step 13: Secure Your Installation

```bash
# Change basic auth password
nano ~/n8n-ecosystem.config.js
# Update N8N_BASIC_AUTH_PASSWORD
# Save and exit

# Restart n8n
pm2 restart n8n

# Generate new encryption key
openssl rand -base64 32
# Update N8N_ENCRYPTION_KEY in ecosystem file
# Restart again
pm2 restart n8n
```

**IMMEDIATELY CHANGE:**
1. ✅ Hostinger account password
2. ✅ n8n basic auth password
3. ✅ n8n encryption key

---

## Hostinger-Specific Tips

### Access Server via Hostinger Panel

If SSH is not working:
1. Go to Hostinger hPanel
2. VPS → Your instance
3. Click **Access** → **Web Terminal**
4. Terminal opens in browser

### Restart Server

```bash
# Via command
reboot

# Or via Hostinger panel
VPS → Your instance → Actions → Restart
```

### Check Server Resources

```bash
# Check disk space
df -h

# Check memory
free -h

# Check CPU
top

# Or via Hostinger panel
VPS → Your instance → Statistics
```

### Backup Your n8n Data

```bash
# Create backup script
nano ~/backup-n8n.sh
```

Add:
```bash
#!/bin/bash
tar -czf /root/n8n-backup-$(date +%Y%m%d).tar.gz /root/.n8n/
# Keep only last 7 days
find /root/ -name "n8n-backup-*.tar.gz" -mtime +7 -delete
```

Make executable and schedule:
```bash
chmod +x ~/backup-n8n.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add line:
0 2 * * * /root/backup-n8n.sh
```

---

## Management Commands

```bash
# Check n8n status
pm2 status

# View n8n logs
pm2 logs n8n

# Restart n8n
pm2 restart n8n

# Stop n8n
pm2 stop n8n

# Start n8n
pm2 start n8n

# Check Nginx status
systemctl status nginx

# Restart Nginx
systemctl restart nginx

# Check SSL certificate
certbot certificates

# Renew SSL manually
certbot renew
```

---

## Troubleshooting

### Issue: Can't access n8n.neuraforz.com

**Check:**
```bash
# 1. Is n8n running?
pm2 status
pm2 logs n8n

# 2. Is Nginx running?
systemctl status nginx
nginx -t

# 3. Is firewall open?
ufw status

# 4. DNS propagated?
nslookup n8n.neuraforz.com

# 5. Check port 5678
netstat -tlnp | grep 5678
```

### Issue: 502 Bad Gateway

```bash
# Restart n8n
pm2 restart n8n

# Check logs
pm2 logs n8n --lines 50
tail -f /var/log/nginx/n8n-error.log
```

### Issue: SSL Certificate Error

```bash
# Check certificate
certbot certificates

# Renew certificate
certbot renew --force-renewal

# Restart Nginx
systemctl restart nginx
```

### Issue: Out of Memory

```bash
# Check memory
free -h

# Increase PM2 memory limit
nano ~/n8n-ecosystem.config.js
# Change: max_memory_restart: '2G'
pm2 restart n8n

# Or upgrade VPS in Hostinger panel
```

---

## Next Steps

1. ✅ Login to https://n8n.neuraforz.com
2. ✅ Change default password
3. ✅ Import your workflow: "EOB Processing with Document Category Routing - Final.json"
4. ✅ Configure Google Drive credentials
5. ✅ Configure OpenAI credentials
6. ✅ Test webhook: https://n8n.neuraforz.com/webhook/eob-process
7. ✅ Integrate with Laravel at crc.truercm.com

---

## Security Checklist

- [ ] Changed Hostinger password
- [ ] Changed n8n basic auth password
- [ ] Updated encryption key
- [ ] Configured firewall (UFW)
- [ ] SSL certificate active
- [ ] Regular backups scheduled
- [ ] Server logs monitored

---

## Support

**Hostinger Support:**
- Live Chat: Available in hPanel
- Tickets: hPanel → Support
- Knowledge Base: https://support.hostinger.com

**n8n Support:**
- Community Forum: https://community.n8n.io
- Documentation: https://docs.n8n.io

---

## Cost Summary

**Hostinger Cloud VPS:**
- Usually $8-15/month (check your plan)

**No n8n subscription needed** - it's FREE! ✅

**API Costs:**
- Google Document AI: ~$0.015/page
- OpenAI: ~$0.03/1K tokens
- Google Drive: Free (15GB)

---

**Your n8n instance will be running at:**
🔗 **https://n8n.neuraforz.com**

**Default login:**
- Username: admin
- Password: (set in ecosystem config)

**Change immediately after first login!**

---

**Document Version**: 1.0.0  
**Last Updated**: November 13, 2025  
**Status**: Production Ready ✅
