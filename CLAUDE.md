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

## COMPLETED FEATURES

### Table Session Lifecycle ✅
**Status: COMPLETE — deployed 2026-06-27**

Table statuses: `available → occupied → bill_pending → available`
- `sessionStartedAt` — when customer session began (booking timestamp)  
- `sessionClosedAt` — when table was freed (checkout timestamp)
- `sessionBillTotal` — running total across all served orders in one session
- `hasNewOrder` — Boolean, pulses "New Order" badge on table card
- History kept for `orderHistoryDays` days (1–7, default 1, set in Settings → Operations)

Socket event `table:status` → `{ tableId, tableNumber, status, hasNewOrder, sessionBillTotal }`

**Admin TableManager:**
- bill_pending cards show ₹ total in amber
- "New Order ●" pulse badge
- Click occupied/bill_pending → Session Modal (all orders + timestamps + pending payment confirm + Print button)
- History Modal (last N days, Print per order)
- Real-time via `table:status` socket

---

### Payment Notification Flow ✅
**Status: COMPLETE — deployed 2026-06-27**

**Customer flow:**
1. Customer on `/payment/:orderId` — sees bill summary
2. **Scan & Pay (Recommended)** → shows dynamic Canvas QR generated from `upi://pay?pa=...&am=AMOUNT&cu=INR`  
   → Customer opens any UPI app, scans → amount pre-filled → pays → taps "Payment Done — Notify Staff"
3. **GPay / PhonePe** → Android `intent://` URI (Chrome passes to OS to open app)  
   → If payment completes, tap "I've Completed UPI Payment" → notify staff
4. **Cash / Card** → taps button → `POST /api/payments/request/:orderId` → socket `payment:pending`
   → "Waiter has been notified" screen

**Staff notification:**
- Socket `payment:pending` → waiter app "Payments" tab shows card with method selector + "Mark Collected"
- Admin session modal shows pending payment banner + Confirm
- `PATCH /api/payments/:id/mark-received` → socket `payment:received` → customer sees Download/Share receipt

**Receipt:**
- `client/src/utils/receiptCanvas.js` — 58mm thermal-style Canvas receipt
- Customer: Download PNG + Share (Web Share API opens share sheet)
- Admin/Waiter: Print → `window.print()` with `@page { size: 58mm auto }`

**"Same QR = Pay too" — Smart menu landing:**
- Customer re-scans table QR → `/menu?hotel=X&table=TOKEN`
- If `lastOrder` in sessionStorage: banner shows **"Track Order"** + **"Pay Bill"** buttons
- "Pay Bill" → navigates to `/payment/:orderId`

**New API endpoints:**
- `POST /api/payments/request/:orderId` — customer (sessionId) or staff
- `GET /api/payments/pending` — staff (admin/waiter)

---

### Waiter Assignment Modes ✅
Three modes selectable in Settings → Staff & Assignment:
- **table**: pre-assign waiter per table zone, auto-assign on order
- **manual**: admin dispatches per order from Live Orders screen
- **claim**: waiters self-claim from shared pool

---

### Other Completed Features
- Menu: half/full plate prices, WebP upload (sharp@0.32.6 for Node 18.14.0), custom course types
- Tables: QR code with table number label for printing
- Settings → Operations: Order History Retention (1–7 days), KDS toggle, Modification Window
- Settings → Payment: UPI ID, static QR upload, receipt flow
- Auto deploy: `pnpm deploy` = build + pscp upload via `deploy/upload-dist.mjs`

---

## DB Model Reference

### Table
```js
status:           enum ['available','occupied','reserved','blocked','bill_pending']
currentOrderId:   ObjectId ref Order
sessionStartedAt: Date   // when session began
sessionClosedAt:  Date   // when table was freed
sessionBillTotal: Number // running total for session
hasNewOrder:      Boolean
assignedWaiterId: ObjectId ref User
```

### Hotel.settings
```js
waiterMode:             enum ['table','manual','claim']  default 'table'
orderHistoryDays:       Number  default 1, min 1, max 7
kdsEnabled:             Boolean
tableVisibilityPublic:  Boolean
orderModificationWindow: Number (minutes)
```

### Payment
```js
orderId, tableNumber, amount, method, status (pending/received/disputed)
receivedBy: ObjectId ref User
receivedAt: Date
receiptUrl: String
```

## Socket Events
| Event | Payload | When |
|-------|---------|------|
| `table:status` | `{ tableId, tableNumber, status, hasNewOrder, sessionBillTotal }` | placeOrder, served, checkout, updateStatus |
| `payment:pending` | `{ paymentId, orderId, tableNumber, tableId, amount, method }` | customer requests payment |
| `payment:received` | `{ paymentId, orderId, amount, method, tableNumber, receiptUrl }` | staff confirms collection |
| `order:new` | `{ order }` | new order placed |
| `order:ready` | `{ orderId }` | KDS marks ready |
| `order:served` | `{ orderId }` | waiter marks served |

---

## IN PROGRESS — Phase 2 Features

### F1 — Waiter-Initiated Orders
**Status: PLANNED**

Waiter scans table QR (or picks table in WaiterApp) → places order on behalf of customer.

**Flow:**
- WaiterApp: new "New Order" tab → table picker (list of available/occupied tables)
- Waiter selects table → sees text-only menu (name, price, qty stepper, no images) with category tabs
- Submits order → `POST /api/orders/waiter` (JWT-authenticated)
- Order tagged: `placedBy: { userId, name, role: 'waiter' }`
- Admin/KDS show "by [Waiter Name]" label on order card

**New files (do not touch existing):**
- `client/src/views/waiter/WaiterOrderPage.jsx` — table picker + text menu + order form
- `server/src/controllers/waiter-order.controller.js` — place order as waiter

**DB change (non-breaking, optional field):**
- `Order.placedBy: { userId: ObjectId, name: String, role: String }` — null for customer orders

**New route:** `POST /api/orders/waiter` — auth required (waiter/admin)

---

### F2 — Waiter "Collect Amount" with Hotel UPI QR
**Status: PLANNED**

In WaiterApp Payments tab, payment card gets "Collect Amount" button.

**Flow:**
- Waiter taps "Collect Amount" → modal shows hotel UPI QR (based on hotel settings):
  - If hotel has `upiId` configured → dynamic Canvas QR with amount pre-filled (`upi://pay?pa=...&am=AMOUNT`)
  - If hotel has static `upiQrUrl` uploaded → shows that image
  - Both shown if both configured
- Waiter shows screen to customer → customer scans + pays
- Waiter taps "Mark Collected" with method (Cash / Card / UPI)
- `PATCH /api/payments/:id/mark-received` (existing) → `payment:received` socket → admin notified

**Changes:** Only `WaiterApp.jsx` PaymentCollectCard — add modal with hotel QR display. No server changes needed.

---

### F3 — Admin Payment History Page
**Status: PLANNED**

New standalone admin page (separate from existing TableManager session modal).

**Page:** `client/src/views/admin/PaymentHistory.jsx`
- Table: Date | Table# | Amount | Method | Collected By | Time
- Sorted newest first, grouped by date
- Filter by date range (optional, simple)

**New API:** `GET /api/payments/history?from=&to=` → returns Payment docs populated with `receivedBy.name`

**New server file:** logic added to `payment.controller.js` as new export (existing functions untouched)

**Admin router:** new `/payments` link in admin nav sidebar

---

### F4 — Hotel Operating Hours + Daily Order Counter
**Status: PLANNED**

**Settings page (Operations section) — new fields:**
- `hotelStartTime`: string "HH:MM", default "09:00"  
- `hotelEndTime`: string "HH:MM", default "23:00"
- Timezone: hardcoded `Asia/Kolkata` (IST) — India-only project, no UI needed

**Table card daily counter:**
- `GET /api/tables` response includes `todayOrderCount` per table
- Server computes: count orders for that table between today's `hotelStartTime` and `hotelEndTime` (IST)
- Counter resets at `hotelEndTime` (new "day" starts)
- Shown as small badge on table card: "5 today"

**DB change:** No schema change — counted live from Order collection on each fetch

**Hotel.settings additions:**
```js
hotelStartTime: { type: String, default: '09:00' }  // "HH:MM" IST
hotelEndTime:   { type: String, default: '23:00' }  // "HH:MM" IST
```

---

### F5 — Admin Order Records Page (Day-wise + Guarded Delete)
**Status: PLANNED**

New standalone admin page: `client/src/views/admin/OrderRecords.jsx`

**Display:**
- Orders grouped by operating day (based on hotelStartTime/hotelEndTime)
- Each order: table#, placed by (waiter name if waiter order), items summary, total, time
- Expandable day sections

**Delete — two modes, both require confirmation code:**

1. **Delete All Records** — wipes all orders + payments for this hotel
2. **Delete Before Date** — date picker → wipes orders + payments created before that date

**Confirmation code flow:**
- Admin clicks delete → sees: *"Request a Confirmation Code from Super Admin at iotsoft.in/clients"*
- Admin enters 6-digit code → validated server-side → delete proceeds
- Code is single-use, time-limited (5 minutes)

**External Super Admin API (for iotsoft.in/clients to call):**
```
POST /api/admin/generate-delete-code
Headers: x-superadmin-secret: <shared secret in server .env as SUPERADMIN_SECRET>
Body: { hotelId, expiresInSeconds: 300 }
Response: { code: "847291", expiresAt: "2026-06-30T10:05:00Z" }
```

**Delete endpoints (admin JWT required + valid code):**
```
DELETE /api/orders/all?code=847291
DELETE /api/orders/before-date?date=2026-06-15&code=847291
```

**New model:** `DeleteCode` — `{ hotelId, code, expiresAt, usedAt }` — single-use

**New files:**
- `server/src/models/DeleteCode.js`
- `server/src/controllers/records.controller.js` — generateDeleteCode, deleteAll, deleteBeforeDate
- `server/src/routes/records.routes.js`
- `client/src/views/admin/OrderRecords.jsx`

---

## Implementation Order (Phase 2)

1. DB model changes: Order.placedBy, Hotel.settings (hotelStartTime/hotelEndTime), DeleteCode model
2. F1 server: waiter-order route + controller
3. F1 client: WaiterOrderPage.jsx
4. F2 client: WaiterApp PaymentCollectCard hotel QR modal
5. F3 server: GET /api/payments/history
6. F3 client: PaymentHistory.jsx + admin nav
7. F4 server: todayOrderCount in GET /api/tables
8. F4 client: Settings fields + table card badge
9. F5 server: DeleteCode model + records routes
10. F5 client: OrderRecords.jsx
