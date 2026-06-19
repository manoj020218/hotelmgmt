process.env.JWT_SECRET         = 'test_jwt_secret_32_characters_xxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_xxxxx';
process.env.VPS_PUBLIC_URL     = 'http://test.example.com';
process.env.UPLOADS_DIR        = require('os').tmpdir();
process.env.FRONTEND_URL       = 'http://frontend.test';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request  = require('supertest');
const express  = require('express');
const jwt      = require('jsonwebtoken');

const analyticsRoutes = require('../src/routes/analytics.routes');
const errorHandler    = require('../src/middleware/errorHandler');
const Hotel           = require('../src/models/Hotel');
const User            = require('../src/models/User');
const Table           = require('../src/models/Table');
const MenuItem        = require('../src/models/MenuItem');
const Order           = require('../src/models/Order');
const Payment         = require('../src/models/Payment');

// ── Test app ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/analytics', analyticsRoutes);
app.use(errorHandler);

// ── Fixtures ──────────────────────────────────────────────────────────────────
let mongod;
let p9Hotel, p9HotelEmpty;
let adminUser, adminToken, adminEmpty, adminEmptyToken;
let waiter1;
let table1;
let menuA, menuB;

function signToken(userId, role) {
  return jwt.sign({ id: userId.toString(), role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function makeOrder(overrides) {
  const base = {
    hotelId:     null,
    tableId:     null,
    tableNumber: 1,
    sessionId:   `sess-${Date.now()}-${Math.random()}`,
    status:      'served',
    items:       [],
    bill:        { subtotal: 0, cgst: 0, sgst: 0, total: 0 },
  };
  return Order.create({ ...base, ...overrides });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Two hotels
  p9Hotel      = await Hotel.create({ name: 'P9 Hotel', gstEnabled: false });
  p9HotelEmpty = await Hotel.create({ name: 'P9 Empty Hotel' });

  adminUser  = await User.create({
    hotelId: p9Hotel._id, name: 'Admin', email: 'admin@p9.com', passwordHash: 'Admin@123', role: 'admin',
  });
  adminEmpty = await User.create({
    hotelId: p9HotelEmpty._id, name: 'AdminE', email: 'admin@empty.com', passwordHash: 'Admin@123', role: 'admin',
  });
  adminToken      = signToken(adminUser._id, 'admin');
  adminEmptyToken = signToken(adminEmpty._id, 'admin');

  waiter1 = await User.create({
    hotelId: p9Hotel._id, name: 'Waiter One', phone: '1111111111', pin: '1111', role: 'waiter',
  });

  table1 = await Table.create({ hotelId: p9Hotel._id, tableNumber: 1, capacity: 4, qrToken: 'p9-t1' });

  menuA = await MenuItem.create({
    hotelId: p9Hotel._id, name: 'Item Alpha', price: 100, category: 'Mains', isVeg: true, isAvailable: true,
  });
  menuB = await MenuItem.create({
    hotelId: p9Hotel._id, name: 'Item Beta', price: 50, category: 'Starters', isVeg: true, isAvailable: true,
  });

  const now       = new Date();
  const sixAgo    = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  const eightAgo  = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
  const janDate   = new Date('2024-01-15T10:00:00.000Z');
  const febDate   = new Date('2024-02-15T10:00:00.000Z');

  // orderA: served today, 2×menuA @ 100 = 200, servedAt = now + 60min
  await makeOrder({
    hotelId:          p9Hotel._id,
    tableId:          table1._id,
    sessionId:        'sess-A',
    status:           'served',
    assignedWaiterId: waiter1._id,
    items:            [{ menuItemId: menuA._id, name: 'Item Alpha', price: 100, quantity: 2 }],
    bill:             { subtotal: 200, cgst: 0, sgst: 0, total: 200 },
    placedAt:         now,
    servedAt:         new Date(now.getTime() + 60 * 60000),
    createdAt:        now,
  });

  // orderB: served today, 1×menuB @ 50 = 50, servedAt = now + 30min
  await makeOrder({
    hotelId:          p9Hotel._id,
    tableId:          table1._id,
    sessionId:        'sess-B',
    status:           'served',
    assignedWaiterId: waiter1._id,
    items:            [{ menuItemId: menuB._id, name: 'Item Beta', price: 50, quantity: 1 }],
    bill:             { subtotal: 50, cgst: 0, sgst: 0, total: 50 },
    placedAt:         now,
    servedAt:         new Date(now.getTime() + 30 * 60000),
    createdAt:        now,
  });

  // orderWeek: served 6 days ago
  await makeOrder({
    hotelId:   p9Hotel._id,
    tableId:   table1._id,
    sessionId: 'sess-week',
    status:    'served',
    items:     [{ menuItemId: menuA._id, name: 'Item Alpha', price: 100, quantity: 1 }],
    bill:      { subtotal: 100, cgst: 0, sgst: 0, total: 100 },
    placedAt:  sixAgo,
    servedAt:  sixAgo,
    createdAt: sixAgo,
  });

  // orderOld: served 8 days ago (excluded from period=week)
  await makeOrder({
    hotelId:   p9Hotel._id,
    tableId:   table1._id,
    sessionId: 'sess-old',
    status:    'served',
    items:     [{ menuItemId: menuA._id, name: 'Item Alpha', price: 100, quantity: 1 }],
    bill:      { subtotal: 100, cgst: 0, sgst: 0, total: 100 },
    placedAt:  eightAgo,
    servedAt:  eightAgo,
    createdAt: eightAgo,
  });

  // orderJan, orderFeb: for date range and monthly groupBy tests
  await makeOrder({
    hotelId:   p9Hotel._id,
    tableId:   table1._id,
    sessionId: 'sess-jan',
    status:    'served',
    items:     [{ menuItemId: menuA._id, name: 'Item Alpha', price: 100, quantity: 1 }],
    bill:      { subtotal: 100, cgst: 0, sgst: 0, total: 100 },
    placedAt:  janDate,
    servedAt:  janDate,
    createdAt: janDate,
  });
  await makeOrder({
    hotelId:   p9Hotel._id,
    tableId:   table1._id,
    sessionId: 'sess-feb',
    status:    'served',
    items:     [{ menuItemId: menuA._id, name: 'Item Alpha', price: 100, quantity: 1 }],
    bill:      { subtotal: 100, cgst: 0, sgst: 0, total: 100 },
    placedAt:  febDate,
    servedAt:  febDate,
    createdAt: febDate,
  });

  // Payments for today's orders (cash + upi → 50% each)
  const orderA = await Order.findOne({ hotelId: p9Hotel._id, sessionId: 'sess-A' });
  const orderB = await Order.findOne({ hotelId: p9Hotel._id, sessionId: 'sess-B' });

  await Payment.create({
    hotelId: p9Hotel._id, orderId: orderA._id, tableNumber: 1,
    amount: 200, method: 'cash', status: 'received', receivedAt: now,
  });
  await Payment.create({
    hotelId: p9Hotel._id, orderId: orderB._id, tableNumber: 1,
    amount: 50, method: 'upi', status: 'received', receivedAt: now,
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('P09 - Analytics', () => {

  // ── 1 ──────────────────────────────────────────────────────────────────────
  test('Dashboard returns correct revenue for today', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard?period=today')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    // revenue from orderA (200) + orderB (50) = 250
    expect(res.body.revenue.total).toBe(250);
    expect(res.body.orders.total).toBe(2);
    expect(res.body.avgOrderValue).toBe(125);
  });

  // ── 2 ──────────────────────────────────────────────────────────────────────
  test('Dashboard revenue is 0 for day with no orders', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard?period=today')
      .set('Authorization', `Bearer ${adminEmptyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.revenue.total).toBe(0);
    expect(res.body.orders.total).toBe(0);
  });

  // ── 3 ──────────────────────────────────────────────────────────────────────
  test('Peak hours calculation correct', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard?period=today')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { peakHours } = res.body;
    expect(Array.isArray(peakHours)).toBe(true);
    expect(peakHours.length).toBeGreaterThanOrEqual(1);

    // Both orderA and orderB are in the same hour → top peak has count=2
    expect(peakHours[0].orderCount).toBe(2);
    expect(peakHours[0].percentage).toBe(100);
    expect(peakHours[0].hour).toBeDefined();
  });

  // ── 4 ──────────────────────────────────────────────────────────────────────
  test('Top items sorted by revenue', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard?period=today')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { topItems } = res.body;
    expect(Array.isArray(topItems)).toBe(true);
    expect(topItems.length).toBeGreaterThanOrEqual(2);

    // Item Alpha: 2 × 100 = 200 revenue (today)
    // Item Beta:  1 × 50  = 50 revenue (today)
    expect(topItems[0].name).toBe('Item Alpha');
    expect(topItems[0].revenue).toBe(200);
    expect(topItems[1].name).toBe('Item Beta');
    expect(topItems[1].revenue).toBe(50);

    // Verify sorted DESC by revenue
    for (let i = 0; i < topItems.length - 1; i++) {
      expect(topItems[i].revenue).toBeGreaterThanOrEqual(topItems[i + 1].revenue);
    }
  });

  // ── 5 ──────────────────────────────────────────────────────────────────────
  test('Payment method split adds to 100%', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard?period=today')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { paymentMethods } = res.body;
    expect(paymentMethods).toBeDefined();

    const sum = Object.values(paymentMethods).reduce((s, v) => s + v, 0);
    expect(sum).toBe(100);
  });

  // ── 6 ──────────────────────────────────────────────────────────────────────
  test('Waiter performance includes avg serve time', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard?period=today')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { waiterPerformance } = res.body;
    expect(Array.isArray(waiterPerformance)).toBe(true);
    expect(waiterPerformance.length).toBeGreaterThanOrEqual(1);

    const w1 = waiterPerformance.find(w => w.name === 'Waiter One');
    expect(w1).toBeDefined();
    expect(w1.served).toBe(2);
    expect(w1.avgServeTime).toBeDefined();
    // avg of (60min + 30min) / 2 = 45min
    expect(w1.avgServeTime).toBe(45);
  });

  // ── 7 ──────────────────────────────────────────────────────────────────────
  test('Revenue by custom date range is accurate', async () => {
    const res = await request(app)
      .get('/api/analytics/revenue?from=2024-01-01&to=2024-12-31')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(Array.isArray(data)).toBe(true);

    // Only orderJan and orderFeb are in 2024 range
    expect(data.length).toBe(2);
    data.forEach(d => {
      expect(d.date.startsWith('2024')).toBe(true);
      expect(d.revenue).toBeDefined();
      expect(d.orderCount).toBeDefined();
    });
  });

  // ── 8 ──────────────────────────────────────────────────────────────────────
  test('CSV export has correct headers and rows', async () => {
    const res = await request(app)
      .get('/api/analytics/export?period=today')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);

    const lines = res.text.trim().split('\n');
    expect(lines[0]).toBe('orderId,tableNumber,status,total,createdAt');
    expect(lines.length).toBeGreaterThan(1); // at least header + 1 data row
  });

  // ── 9 ──────────────────────────────────────────────────────────────────────
  test('Period filter "week" covers last 7 days', async () => {
    const [resToday, resWeek] = await Promise.all([
      request(app)
        .get('/api/analytics/dashboard?period=today')
        .set('Authorization', `Bearer ${adminToken}`),
      request(app)
        .get('/api/analytics/dashboard?period=week')
        .set('Authorization', `Bearer ${adminToken}`),
    ]);

    expect(resToday.status).toBe(200);
    expect(resWeek.status).toBe(200);

    // period=today: orderA + orderB = 2
    // period=week:  orderA + orderB + orderWeek (6 days ago) = 3
    expect(resToday.body.orders.total).toBe(2);
    expect(resWeek.body.orders.total).toBe(3);

    // orderOld (8 days ago) must NOT appear in week
    expect(resWeek.body.orders.total).toBeLessThan(4);
  });

  // ── 10 ─────────────────────────────────────────────────────────────────────
  test('groupBy month correctly aggregates', async () => {
    const res = await request(app)
      .get('/api/analytics/revenue?from=2024-01-01&to=2024-03-01&groupBy=month')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(Array.isArray(data)).toBe(true);

    // orderJan (2024-01) and orderFeb (2024-02) each in own month bucket
    expect(data.length).toBe(2);
    expect(data[0].date).toMatch(/^2024-01/);
    expect(data[1].date).toMatch(/^2024-02/);
    expect(data[0].orderCount).toBe(1);
    expect(data[1].orderCount).toBe(1);
  });

});
