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
