process.env.JWT_SECRET         = 'test_jwt_secret_32_characters_xxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_xxxxx';
process.env.VPS_PUBLIC_URL     = 'http://test.example.com';
process.env.UPLOADS_DIR        = require('os').tmpdir();

// Hoist mocks before any requires that pull in the real implementations
jest.mock('../src/socket/socketHandler', () => ({
  initSocket:   jest.fn(),
  emitToHotel:  jest.fn(),
  emitToOrder:  jest.fn(),
}));

jest.mock('../src/services/fcm.service', () => ({
  sendToToken: jest.fn().mockResolvedValue(null),
  sendToTopic: jest.fn().mockResolvedValue(null),
}));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request  = require('supertest');
const express  = require('express');
const jwt      = require('jsonwebtoken');

const { emitToHotel } = require('../src/socket/socketHandler');

const orderRoutes  = require('../src/routes/order.routes');
const errorHandler = require('../src/middleware/errorHandler');
const Hotel        = require('../src/models/Hotel');
const User         = require('../src/models/User');
const Table        = require('../src/models/Table');
const MenuItem     = require('../src/models/MenuItem');
const Order        = require('../src/models/Order');

// ── Test app ─────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/orders', orderRoutes);
app.use(errorHandler);

// ── Fixtures ─────────────────────────────────────────────────────────────────
let mongod;

// GST hotel (cgst=9, sgst=9, autoWaiterAssign=true)
let gstHotel, adminUser, adminToken;
let table1, table2;          // tables for gstHotel
let gstItem1, gstItem2;      // price 100, 50
let waiter1, waiter2;

// No-GST hotel (gstEnabled=false, autoWaiterAssign=false)
let noGstHotel, noGstTable, noGstItem;

function signToken(userId, role) {
  return jwt.sign({ id: userId.toString(), role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

async function resetTable(tableId) {
  await Table.findByIdAndUpdate(tableId, { status: 'available', currentOrderId: null });
}

async function resetWaiters() {
  await User.findByIdAndUpdate(waiter1._id, { available: true, activeOrderIds: [] });
  await User.findByIdAndUpdate(waiter2._id, { available: true, activeOrderIds: [] });
}

// ── Place a simple order helper ───────────────────────────────────────────────
async function placeSimpleOrder(tableQrToken, items) {
  return request(app)
    .post('/api/orders')
    .send({ tableQrToken, items });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // ── GST hotel ──
  gstHotel = await Hotel.create({
    name:        'GST Hotel',
    gstEnabled:  true,
    cgstPercent: 9,
    sgstPercent: 9,
    settings:    { autoWaiterAssign: true, orderModificationWindow: 5 },
  });

  adminUser  = await User.create({
    hotelId: gstHotel._id, name: 'Admin', email: 'admin@gst.com',
    passwordHash: 'Admin@123', role: 'admin',
  });
  adminToken = signToken(adminUser._id, 'admin');

  waiter1 = await User.create({
    hotelId: gstHotel._id, name: 'Waiter One', phone: '1111111111',
    pin: '1111', role: 'waiter',
  });
  waiter2 = await User.create({
    hotelId: gstHotel._id, name: 'Waiter Two', phone: '2222222222',
    pin: '2222', role: 'waiter',
  });

  table1 = await Table.create({ hotelId: gstHotel._id, tableNumber: 1, capacity: 4, qrToken: 'qr-gst-t1' });
  table2 = await Table.create({ hotelId: gstHotel._id, tableNumber: 2, capacity: 4, qrToken: 'qr-gst-t2' });

  gstItem1 = await MenuItem.create({ hotelId: gstHotel._id, name: 'Dal Makhani', category: 'Mains',    price: 100, isVeg: true });
  gstItem2 = await MenuItem.create({ hotelId: gstHotel._id, name: 'Masala Chai', category: 'Drinks',   price: 50,  isVeg: true });

  // ── No-GST hotel ──
  noGstHotel  = await Hotel.create({
    name:       'NoGST Hotel',
    gstEnabled: false,
    settings:   { autoWaiterAssign: false },
  });
  noGstTable  = await Table.create({ hotelId: noGstHotel._id, tableNumber: 1, capacity: 2, qrToken: 'qr-nogst-t1' });
  noGstItem   = await MenuItem.create({ hotelId: noGstHotel._id, name: 'Veg Biryani', category: 'Mains', price: 200, isVeg: true });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('P04 - Orders', () => {

  // ── 1 ─────────────────────────────────────────────────────────────────────
  test('POST /orders creates order with correct bill including GST', async () => {
    await resetTable(table1._id);
    await resetWaiters();

    // 1x Dal Makhani (100) + 2x Masala Chai (50) = subtotal 200
    const res = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 },
      { menuItemId: gstItem2._id, quantity: 2 },
    ]);

    expect(res.status).toBe(201);
    const { bill } = res.body;
    expect(bill.subtotal).toBe(200);
    expect(bill.cgst).toBe(18);    // 200 * 9%
    expect(bill.sgst).toBe(18);    // 200 * 9%
    expect(bill.total).toBe(236);
    expect(bill.gstApplied).toBe(true);
  });

  // ── 2 ─────────────────────────────────────────────────────────────────────
  test('POST /orders creates order with zero GST when disabled', async () => {
    // noGstHotel, autoWaiterAssign=false — no waiter needed
    const res = await placeSimpleOrder('qr-nogst-t1', [
      { menuItemId: noGstItem._id, quantity: 1 },
    ]);

    expect(res.status).toBe(201);
    const { bill } = res.body;
    expect(bill.subtotal).toBe(200);
    expect(bill.cgst).toBe(0);
    expect(bill.sgst).toBe(0);
    expect(bill.total).toBe(200);
    expect(bill.gstApplied).toBe(false);
  });

  // ── 3 ─────────────────────────────────────────────────────────────────────
  test('POST /orders validates all menuItemIds exist', async () => {
    await resetTable(table1._id);
    const fakeId = new mongoose.Types.ObjectId();

    const res = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: fakeId, quantity: 1 },
    ]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });

  // ── 4 ─────────────────────────────────────────────────────────────────────
  test('POST /orders rejects unavailable menu items', async () => {
    await resetTable(table1._id);
    const unavailableItem = await MenuItem.create({
      hotelId: gstHotel._id, name: 'Sold Out Dish', category: 'Starters',
      price: 120, available: false,
    });

    const res = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: unavailableItem._id, quantity: 1 },
    ]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unavailable/i);
  });

  // ── 5 ─────────────────────────────────────────────────────────────────────
  test('POST /orders updates table status to occupied', async () => {
    await resetTable(table1._id);
    await resetWaiters();

    const res = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 },
    ]);
    expect(res.status).toBe(201);

    const table = await Table.findById(table1._id);
    expect(table.status).toBe('occupied');
    expect(table.currentOrderId.toString()).toBe(res.body.orderId.toString());
  });

  // ── 6 ─────────────────────────────────────────────────────────────────────
  test('waiterAssign picks waiter with fewest active orders', async () => {
    await resetTable(table2._id);
    await resetWaiters();

    // Give waiter1 two dummy active orders so waiter2 should be picked
    const dummy1 = new mongoose.Types.ObjectId();
    const dummy2 = new mongoose.Types.ObjectId();
    await User.findByIdAndUpdate(waiter1._id, { activeOrderIds: [dummy1, dummy2] });

    const res = await placeSimpleOrder('qr-gst-t2', [
      { menuItemId: gstItem1._id, quantity: 1 },
    ]);

    expect(res.status).toBe(201);
    expect(res.body.assignedWaiter).not.toBeNull();
    expect(res.body.assignedWaiter.id.toString()).toBe(waiter2._id.toString());
  });

  // ── 7 ─────────────────────────────────────────────────────────────────────
  test('waiterAssign handles no available waiter (admin queue)', async () => {
    await resetTable(table1._id);

    // Mark all waiters unavailable
    await User.findByIdAndUpdate(waiter1._id, { available: false });
    await User.findByIdAndUpdate(waiter2._id, { available: false });

    const res = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 },
    ]);

    expect(res.status).toBe(201);
    expect(res.body.assignedWaiter).toBeNull();

    // Restore
    await resetWaiters();
  });

  // ── 8 ─────────────────────────────────────────────────────────────────────
  test('waiterAssign updates waiter.activeOrderIds', async () => {
    await resetTable(table1._id);
    await resetWaiters();

    const res = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 },
    ]);
    expect(res.status).toBe(201);

    const assignedId = res.body.assignedWaiter.id;
    const waiter = await User.findById(assignedId);
    const orderIds = waiter.activeOrderIds.map(id => id.toString());
    expect(orderIds).toContain(res.body.orderId.toString());
  });

  // ── 9 ─────────────────────────────────────────────────────────────────────
  test('PATCH modify adds items within window', async () => {
    await resetTable(table1._id);
    await resetWaiters();

    const orderRes = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 }, // 100
    ]);
    expect(orderRes.status).toBe(201);

    const res = await request(app)
      .patch(`/api/orders/${orderRes.body.orderId}/modify`)
      .send({ addItems: [{ menuItemId: gstItem2._id, quantity: 2 }], sessionId: orderRes.body.sessionId }); // +100

    expect(res.status).toBe(200);
    expect(res.body.order.items).toHaveLength(2);
    expect(res.body.order.bill.subtotal).toBe(200);
  });

  // ── 10 ────────────────────────────────────────────────────────────────────
  test('PATCH modify rejected after modification window closed', async () => {
    await resetTable(table1._id);
    await resetWaiters();

    const orderRes = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 },
    ]);
    expect(orderRes.status).toBe(201);

    // Wind back placedAt to 10 minutes ago (window is 5 minutes)
    const past = new Date(Date.now() - 10 * 60 * 1000);
    await Order.findByIdAndUpdate(orderRes.body.orderId, { placedAt: past });

    const res = await request(app)
      .patch(`/api/orders/${orderRes.body.orderId}/modify`)
      .send({ addItems: [{ menuItemId: gstItem2._id, quantity: 1 }], sessionId: orderRes.body.sessionId });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/window/i);
  });

  // ── 11 ────────────────────────────────────────────────────────────────────
  test('PATCH modify rejected when KDS has accepted order', async () => {
    await resetTable(table1._id);
    await resetWaiters();

    const orderRes = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 },
    ]);
    expect(orderRes.status).toBe(201);

    // Move order past the modifiable window by updating status
    await Order.findByIdAndUpdate(orderRes.body.orderId, { status: 'preparing' });

    const res = await request(app)
      .patch(`/api/orders/${orderRes.body.orderId}/modify`)
      .send({ addItems: [{ menuItemId: gstItem2._id, quantity: 1 }], sessionId: orderRes.body.sessionId });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/status/i);
  });

  // ── 12 ────────────────────────────────────────────────────────────────────
  test('PATCH status served updates table to available', async () => {
    await resetTable(table1._id);
    await resetWaiters();

    const orderRes = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 },
    ]);
    expect(orderRes.status).toBe(201);

    const res = await request(app)
      .patch(`/api/orders/${orderRes.body.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'served' });

    expect(res.status).toBe(200);

    const table = await Table.findById(table1._id);
    expect(table.status).toBe('available');
    expect(table.currentOrderId).toBeNull();
  });

  // ── 13 ────────────────────────────────────────────────────────────────────
  test('PATCH status served removes orderId from waiter.activeOrderIds', async () => {
    await resetTable(table1._id);
    await resetWaiters();

    const orderRes = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 },
    ]);
    expect(orderRes.status).toBe(201);

    const assignedId = orderRes.body.assignedWaiter && orderRes.body.assignedWaiter.id;
    expect(assignedId).toBeTruthy();

    await request(app)
      .patch(`/api/orders/${orderRes.body.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'served' });

    const waiter = await User.findById(assignedId);
    const orderIds = waiter.activeOrderIds.map(id => id.toString());
    expect(orderIds).not.toContain(orderRes.body.orderId.toString());
  });

  // ── 14 ────────────────────────────────────────────────────────────────────
  test('PATCH status served makes waiter available if below threshold', async () => {
    await resetTable(table1._id);
    await resetWaiters();

    const orderRes = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 },
    ]);
    expect(orderRes.status).toBe(201);

    const assignedId = orderRes.body.assignedWaiter && orderRes.body.assignedWaiter.id;
    expect(assignedId).toBeTruthy();

    // Waiter has exactly 1 active order (< threshold 3) → should become available after serve
    await request(app)
      .patch(`/api/orders/${orderRes.body.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'served' });

    const waiter = await User.findById(assignedId);
    expect(waiter.available).toBe(true);
    expect(waiter.activeOrderIds).toHaveLength(0);
  });

  // ── 15 ────────────────────────────────────────────────────────────────────
  test('Bill recalculated correctly after modification', async () => {
    await resetTable(table1._id);
    await resetWaiters();

    // Initial: 1x Dal Makhani (100) → subtotal=100, cgst=9, sgst=9, total=118
    const orderRes = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 },
    ]);
    expect(orderRes.status).toBe(201);
    expect(orderRes.body.bill.subtotal).toBe(100);
    expect(orderRes.body.bill.total).toBe(118);

    // Add: 1x Masala Chai (50) → new subtotal=150, cgst=13.5, sgst=13.5, total=177
    const modRes = await request(app)
      .patch(`/api/orders/${orderRes.body.orderId}/modify`)
      .send({ addItems: [{ menuItemId: gstItem2._id, quantity: 1 }] });

    expect(modRes.status).toBe(200);
    const { bill } = modRes.body.order;
    expect(bill.subtotal).toBe(150);
    expect(bill.cgst).toBe(13.5);
    expect(bill.sgst).toBe(13.5);
    expect(bill.total).toBe(177);
  });

  // ── 16 ────────────────────────────────────────────────────────────────────
  test('Socket event order:new emitted on order creation', async () => {
    await resetTable(table1._id);
    await resetWaiters();

    const res = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 },
    ]);
    expect(res.status).toBe(201);

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'order:new',
      expect.objectContaining({ orderId: expect.anything() })
    );
  });

  // ── 17 ────────────────────────────────────────────────────────────────────
  test('Socket event order:served emitted on status served', async () => {
    await resetTable(table1._id);
    await resetWaiters();

    const orderRes = await placeSimpleOrder('qr-gst-t1', [
      { menuItemId: gstItem1._id, quantity: 1 },
    ]);
    expect(orderRes.status).toBe(201);

    jest.clearAllMocks(); // clear the order:new call

    await request(app)
      .patch(`/api/orders/${orderRes.body.orderId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'served' });

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'order:served',
      expect.objectContaining({ orderId: expect.anything() })
    );
  });

});
