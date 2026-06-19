# Deployment Guide — Hotel QR Ordering System

## Architecture

```
VPS (self-hosted)
  └── Node.js + PM2  → port 5000
  └── MongoDB        → localhost:27017
  └── /uploads/      → static files (photos, QR PNGs, PDF receipts)
  └── Nginx          → reverse proxy to Node, serves /uploads

Vercel (free tier)
  └── React SPA      → VITE_ env vars pointing to VPS
```

---

## Step 1 — VPS Prerequisites

```bash
# Confirm Node 20 is installed
node -v   # should print v20.x.x

# If not, install via nvm:
curl -fsSL https://fnm.vercel.app/install | bash
fnm install 20 && fnm use 20

# Confirm MongoDB is running (already installed on this VPS)
mongosh --eval "db.adminCommand('ping')"

# Install PM2 globally
npm install -g pm2

# Create upload directories
mkdir -p /var/www/hotel-qr/uploads/{menu,qr,receipts,upi}
chmod -R 755 /var/www/hotel-qr/uploads
```

---

## Step 2 — Clone & Configure Server

```bash
cd /var/www/hotel-qr
git clone <your-repo-url> .

cd server
npm install --production

# Copy environment file
cp .env.example .env
nano .env
```

### Required values in server/.env

```env
NODE_ENV=production
PORT=5000

MONGODB_URI=mongodb://localhost:27017/hotel-qr

JWT_SECRET=<generate: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate: openssl rand -hex 32>
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

VPS_PUBLIC_URL=https://yourdomain.com
UPLOADS_DIR=/var/www/hotel-qr/uploads

FIREBASE_PROJECT_ID=<from Firebase Console>
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@project.iam.gserviceaccount.com

CLIENT_URL=https://yourapp.vercel.app
ADMIN_SEED_EMAIL=admin@yourhotel.com
ADMIN_SEED_PASSWORD=ChangeMe@123
```

---

## Step 3 — Firebase FCM Setup

1. Go to [Firebase Console](https://console.firebase.google.com) → Create project
2. Project Settings → Service Accounts → Generate new private key → download JSON
3. Copy `private_key`, `project_id`, `client_email` from JSON → paste into server/.env
4. Project Settings → General → Web API key → use for client VITE_FIREBASE_* vars

---

## Step 4 — Run Production Seed

```bash
cd /var/www/hotel-qr/server

# Seeds hotel, admin user, kitchen user, 10 tables, 6 menu items
# Safe to run: checks for existing hotel and exits without changes if found
node src/seeds/productionSeed.js
```

---

## Step 5 — Start Server with PM2

```bash
cd /var/www/hotel-qr/server
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # follow the printed command to enable auto-start on reboot

# Verify
curl http://localhost:5000/api/health
# Expected: {"status":"ok","timestamp":"...","uptime":...}
```

---

## Step 6 — Nginx Configuration

Add this server block to `/etc/nginx/sites-available/hotel-qr`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Serve uploaded files directly (no Node.js overhead)
    location /uploads/ {
        alias /var/www/hotel-qr/uploads/;
        expires 30d;
        add_header Cache-Control "public";
    }

    # Proxy API + Socket.io to Node
    location /api/ {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /socket.io/ {
        proxy_pass         http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hotel-qr /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL via Certbot (free)
sudo certbot --nginx -d yourdomain.com
```

---

## Step 7 — Deploy Frontend to Vercel

1. Push client/ code to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → import repo
3. Set **Root Directory** to `client`
4. Set **Build Command** to `pnpm build` (or `npm run build`)
5. Add Environment Variables:

```
VITE_API_URL=https://yourdomain.com/api
VITE_SOCKET_URL=https://yourdomain.com
VITE_FIREBASE_API_KEY=<from Firebase Console>
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
VITE_FIREBASE_APP_ID=<app-id>
VITE_VPS_PUBLIC_URL=https://yourdomain.com
```

6. Deploy — Vercel provides a `*.vercel.app` URL

7. Update `CLIENT_URL` in server/.env with the Vercel URL, then `pm2 restart hotel-qr-server`

---

## Step 8 — Update CORS for Production

In `server/.env`, set:
```
CLIENT_URL=https://yourapp.vercel.app
```

In `server/src/index.js`, verify:
```js
app.use(cors({ origin: process.env.CLIENT_URL }))
```

---

## Smoke Test Checklist

After deployment, run through this manually:

```
[ ] Admin login works at https://yourapp.vercel.app/admin/login
[ ] Create a test menu item with photo
      → Verify file appears at https://yourdomain.com/uploads/menu/filename.jpg
[ ] Scan QR from mobile (download from Admin → Tables → QR)
      → Menu loads correctly on mobile browser
[ ] Place an order as customer
      → Waiter gets assigned (check WaiterApp)
[ ] KDS shows the order (at /kds, login with kitchen PIN)
[ ] KDS accepts → order status updates for customer
[ ] KDS marks ready → waiter sees "Ready for pickup"
[ ] Waiter marks served → customer sees PAY button
[ ] Pay via GPay deep link → GPay app opens with correct amount
[ ] Mark payment received (admin or waiter)
      → Receipt PDF accessible at https://yourdomain.com/uploads/receipts/orderId.pdf
[ ] Analytics dashboard shows today's order
[ ] FCM notification received on waiter's mobile device
[ ] /api/health returns {"status":"ok"}
```

---

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| `ENOENT /uploads/...` | Upload dir missing | `mkdir -p /var/www/hotel-qr/uploads/{menu,qr,receipts,upi}` |
| Socket.io 400 bad request | Nginx not proxying WebSocket headers | Add `Upgrade` + `Connection` headers in nginx config |
| CORS error on frontend | CLIENT_URL mismatch | Set `CLIENT_URL` in server .env to exact Vercel URL |
| PM2 process exits on startup | Missing .env | Check `pm2 logs hotel-qr-server` |
| FCM token not saving | Firebase env vars wrong | Verify `FIREBASE_PRIVATE_KEY` has literal `\n` not real newlines |
