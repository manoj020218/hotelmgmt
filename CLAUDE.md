# HotelQR — Codebase Guide

## Tech Stack
- **Server**: Node.js + Express + MongoDB (Mongoose) + Socket.IO + PM2 (cluster mode)
- **Client**: React 18 + Vite + Tailwind CSS (dark theme) + Capacitor (Android APK)
- **Auth**: JWT (access + refresh tokens), role-based (`admin`, `waiter`, `kitchen`)
- **Package manager**: `pnpm` locally (strict-ssl=false); `npm` on VPS (SSL issues with pnpm)
- **VPS**: 154.61.69.200, server port 5001, Nginx reverse proxy

## Key URLs
| App | Domain | Nginx root |
|-----|--------|-----------|
| Admin | hotelqr.admin.iotsoft.in | /var/www/hotel-admin |
| Waiter | hotelqr.waiter.iotsoft.in | /var/www/hotel-waiter |
| KDS | hotelqr.kds.iotsoft.in | /var/www/hotel-kds |

## Deploy Commands (run from `client/`)
```
pnpm deploy           # build admin + upload to VPS
pnpm deploy:waiter    # build waiter + upload
pnpm deploy:kds       # build kds + upload
pnpm deploy:all       # all three
```
VPS credentials stored in `deploy/vps.env` (gitignored).

## Server Start / Restart
```
pm2 restart hotelqr-api
pm2 logs hotelqr-api --lines 15 --nostream
```

---

## ACTIVE IMPLEMENTATION PLAN
### Feature: Table Session Lifecycle — Bill Pending + Order History

**Status: IN PROGRESS**

### Problem
Currently when waiter marks food `served`, the table immediately becomes `available`.
This causes issues: customer hasn't paid, kitchen/waiter has no visibility of bill status.

### New Table Status Flow
```
available ──[customer orders]──► occupied ──[food served]──► bill_pending
   ▲                                                              │
   └──────────────[admin/waiter CHECKOUT]────────────────────────┘
   
bill_pending ──[new order arrives]──► occupied (hasNewOrder flash)
```

### Files to Change (9 total)

#### Server (6 files)

**1. `server/src/models/Table.js`**
- Add `'bill_pending'` to status enum
- Add `sessionStartedAt: Date` — when current customer session began
- Add `hasNewOrder: Boolean` — pulses "New Order" on the table card
- Add `sessionBillTotal: Number` — running total across session orders

**2. `server/src/models/Hotel.js`**
- Add `settings.orderHistoryDays: Number` (default: 1, min: 1, max: 7)

**3. `server/src/controllers/order.controller.js`**
- `placeOrder`: remove 'occupied' block; allow orders during 'occupied'/'bill_pending'
  - New session (available/reserved): set `sessionStartedAt`, reset `sessionBillTotal=0`, `hasNewOrder=false`
  - Continue session (occupied/bill_pending): `status→occupied`, `hasNewOrder=true`, update `currentOrderId`
  - Emit `table:status` after table update
- `updateStatus` (served): table → `bill_pending` (not `available`), add bill to `sessionBillTotal`
  - Emit `table:status` with new sessionBillTotal

**4. `server/src/controllers/table.controller.js`**
- `getAllTables`: populate `currentOrderId` with `status bill items`
- Add `getTableSession(tableId)` → all orders since `sessionStartedAt` sorted asc
- Add `checkoutTable(tableId)` → status=available, clear session fields, emit `table:status`
- Add `getTableHistory(tableId)` → orders from last `orderHistoryDays` days

**5. `server/src/routes/table.routes.js`**
- Add `GET /:tableId/session` (admin + waiter)
- Add `POST /:tableId/checkout` (admin + waiter)
- Add `GET /:tableId/history` (admin)

**6. `server/src/controllers/settings.controller.js`**
- `updateOperations`: handle `orderHistoryDays` (clamp 1–7)

#### Client (3 files)

**7. `client/src/api/table.api.js`**
- Add `getTableSession(tableId)`
- Add `checkoutTable(tableId)`
- Add `getTableHistory(tableId)`

**8. `client/src/views/admin/TableManager.jsx`** ← MAJOR REWRITE
- Status colors: `bill_pending` = amber
- Table card: show `₹{sessionBillTotal}` + "Bill Pending" when bill_pending
- Table card: "New Order ●" pulsing badge when `hasNewOrder=true`
- Clicking occupied/bill_pending table → **Session Modal**
  - Fetches GET /session
  - Shows each order with timestamp + items + subtotal
  - Grand total at bottom
  - "Checkout — Customer Done" button
  - "View History" button (opens History Modal)
- **History Modal**
  - Fetches GET /history
  - Shows orders from last N days with timestamps
- Socket: listen to `table:status` to update cards in real-time

**9. `client/src/views/admin/Settings.jsx`**
- General tab → Operations section: add "Order History Retention (days, 1–7)" field
- Initialize `ops.orderHistoryDays` from `h.settings?.orderHistoryDays ?? 1`

### Socket Events
| Event | Payload | When emitted |
|-------|---------|-------------|
| `table:status` | `{ tableId, tableNumber, status, hasNewOrder, sessionBillTotal }` | placeOrder, updateStatus(served), checkoutTable, updateTableStatus |

### Invariants
- `sessionStartedAt` is set ONLY when table transitions from available/reserved → occupied
- `sessionBillTotal` accumulates across all served orders in session; reset on checkout
- `hasNewOrder` set true when new order arrives during occupied/bill_pending; cleared on serve or checkout
- History query: `Order.find({ tableId, createdAt: { $gte: now - orderHistoryDays * 24h } })`
- Checkout allowed from any status (admin); waiter only sees it when bill_pending
