---
phase: 3
status: planned
priority: high
---

# Phase 3: Nginx + SSL (Let's Encrypt)

## nginx/nginx.conf

Main config — worker processes, events, includes.

## nginx/conf.d/app.conf

Two-step process:
1. **Initial (HTTP only)** — for certbot domain verification
2. **After SSL cert obtained** — full HTTPS config

### Step 1: HTTP-only config (for initial cert)
```nginx
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

### Step 2: Full HTTPS config (after cert obtained)
```nginx
server {
    listen 80;
    server_name ${DOMAIN};

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## SSL Certificate Workflow
1. Start with HTTP-only nginx config
2. Run: `docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot -w /var/www/certbot -d $DOMAIN`
3. Switch to full HTTPS nginx config
4. Reload nginx: `docker compose -f docker-compose.prod.yml exec nginx nginx -s reload`
5. Certbot sidecar handles auto-renewal every 12h

## Todo
- [ ] Create `nginx/nginx.conf`
- [ ] Create `nginx/conf.d/app.conf` (HTTP-only initial version)
- [ ] Create `nginx/conf.d/app.conf.ssl` (full HTTPS template)
- [ ] Document SSL cert obtainment steps in deploy script
