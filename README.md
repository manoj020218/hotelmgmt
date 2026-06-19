# Hotel QR Ordering System

Full-stack hotel QR ordering PWA — Node.js + Express + MongoDB backend, React + Vite + TailwindCSS frontend.

---

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- MongoDB running locally on port 27017

> **Note:** npm has SSL cert issues on this machine. Always use `pnpm`.

---

## Server Setup & Tests

```bash
cd server
pnpm install

# Copy and fill in environment variables
cp .env.example .env
# Minimum required for tests (uses mongodb-memory-server, no real DB needed):
# JWT_SECRET=anysecret32charslong12345678901
# JWT_REFRESH_SECRET=anyrefreshsecret32chars12345678
# VPS_PUBLIC_URL=http://localhost:5000
# UPLOADS_DIR=./uploads

# Run all server tests (130 tests across 11 files)
pnpm test

# Run a single test file
pnpm test -- p01
pnpm test -- p02
# etc.

# Start dev server (requires real MongoDB + full .env)
node src/index.js
```

---

## Client Setup & Tests

```bash
cd client
pnpm install

# Run all frontend tests (86 tests across 15 files) — no .env needed
pnpm vitest run

# Run a single test file
pnpm vitest run src/tests/pf01.menu.test.jsx

# Start dev server (requires server running + .env)
cp .env.example .env   # set VITE_API_URL=http://localhost:5000/api
pnpm dev
```

---

## Environment Variables

### server/.env (minimum for dev)

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/hotel-qr
JWT_SECRET=your_super_secret_key_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
VPS_PUBLIC_URL=http://localhost:5000
UPLOADS_DIR=./uploads
CLIENT_URL=http://localhost:3000
ADMIN_SEED_EMAIL=admin@hotel.com
ADMIN_SEED_PASSWORD=Admin@123
# Firebase optional in dev — leave blank to skip FCM
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

### client/.env (minimum for dev)

```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_VPS_PUBLIC_URL=http://localhost:5000
# Firebase optional — leave blank to skip push notifications
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

---

## Seed the Database

```bash
cd server

# Development seed (1 hotel, admin, 3 waiters, 1 kitchen, 12 tables, 10 menu items)
node src/seeds/seed.js

# Production seed (minimal — checks for existing hotel first, safe to re-run)
node src/seeds/productionSeed.js
```

After seeding:
- Admin login: `admin@hotel.com` / `Admin@123`
- Waiter PIN: `1111`
- Kitchen PIN: `2222`

---

## Running Everything Together

```bash
# Terminal 1 — backend
cd server && node src/index.js

# Terminal 2 — frontend
cd client && pnpm dev

# Open browser:
# Admin:   http://localhost:3000/admin/login
# Waiter:  http://localhost:3000/waiter/login
# KDS:     http://localhost:3000/kds/login
# Customer: http://localhost:3000/menu?hotel=<hotelId>&table=<qrToken>
#           (get hotelId from DB after seeding, or scan the generated QR)
```

---

## Deployment

See [`docs/deploy.md`](docs/deploy.md) for full VPS + Vercel + Nginx + Firebase setup.

---

## Project Structure

```
├── server/          Node.js + Express + Socket.io + MongoDB
│   ├── src/
│   │   ├── models/       Mongoose schemas (7 models)
│   │   ├── routes/       REST API routes
│   │   ├── controllers/  Request handlers
│   │   ├── services/     Business logic (waiter assign, GST, PDF, FCM)
│   │   ├── socket/       Socket.io event handlers
│   │   ├── config/       DB, Firebase, VPS storage
│   │   ├── middleware/   JWT auth, role guard, error handler
│   │   └── seeds/        Dev + production seed scripts
│   ├── tests/            Jest tests (p01–p11)
│   └── ecosystem.config.js  PM2 config
│
├── client/          React 18 + Vite 5 + TailwindCSS v3 PWA
│   ├── src/
│   │   ├── views/        customer/ waiter/ kds/ admin/ auth/
│   │   ├── api/          Axios API modules per domain
│   │   ├── stores/       Zustand stores (auth, cart, notifications)
│   │   ├── hooks/        useSocket, useAuth, useFCM, usePWAInstall
│   │   ├── components/   Shared UI (Button, Badge, Modal, Spinner…)
│   │   └── tests/        Vitest tests (pf01–pf15)
│   └── vercel.json       SPA rewrite rules for Vercel
│
├── docs/
│   └── deploy.md         Full deployment guide
└── PROJECT.md            Master spec — all 28 pipeline specs + session log
```
