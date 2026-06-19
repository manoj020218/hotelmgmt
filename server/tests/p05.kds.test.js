process.env.JWT_SECRET         = 'test_jwt_secret_32_characters_xxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_xxxxx';
process.env.VPS_PUBLIC_URL     = 'http://test.example.com';
process.env.UPLOADS_DIR        = require('os').tmpdir();

jest.mock('../src/socket/socketHandler', () => ({
  initSocket:  jest.fn(),
  emitToHotel: jest.fn(),
  emitToOrder: jest.fn(),
}));

jest.mock('../src/services/fcm.service', () => ({
  sendToToken: jest.fn().mockResolvedValue(null),
  sendToTopic: jest.fn().mockResolvedValue(null),
}));

const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request  = require('supertest');
const express  = require('express');
const jwt      = require('jsonwebtoken');

const { emitToHotel } = require('../src/socket/socketHandler');
const { sendToToken } = require('../src/services/fcm.service');

const kdsRoutes    = require('../src/routes/kds.routes');
const errorHandler = require('../src/middleware/errorHandler');
const Hotel        = require('../src/models/Hotel');
const User         = require('../src/models/User');
const Table        = require('../src/models/Table');
const MenuItem     = require('../src/models/MenuItem');
const Order        = require('../src/models/Order');

// ── Test app ─────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/kds', kdsRoutes);
app.use(errorHandler);

// ── Fixtures ─────────────────────────────────────────────────────────────────
let mongod, kdsHotel, kdsTable, kdsItem;
let kitchenUser, kitchenToken, adminUser, adminToken, waiterUser;

function signToken(userId, role) {
  return jwt.sign({ id: userId.toString(), role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

// Create a test order directly in DB (bypasses HTTP layer)
async function makeOrder(overrides = {}) {
  return Order.create({
    hotelId:     kdsHotel._id,
    tableId:     kdsTable._id,
    tableNumber: 1,
    sessionId:   uuidv4(),
    items:       [{ menuItemId: kdsItem._id, name: kdsItem.name, price: kdsItem.price, quantity: 1 }],
    bill:        { subtotal: 100, cgst: 0, sgst: 0, total: 100, gstApplied: false },
    kdsStatus:   'new',
    status:      'placed',
    ...overrides,
  });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  kdsHotel = await Hotel.create({
    name:       'KDS Hotel',
    gstEnabled: false,
    settings:   { kdsEnabled: true, autoWaiterAssign: false },
  });

  kitchenUser  = await User.create({ hotelId: kdsHotel._id, name: 'Chef',  phone: '1111111111', pin: '1111', role: 'kitchen' });
  adminUser    = await User.create({ hotelId: kdsHotel._id, name: 'Admin', email: 'admin@kds.com', passwordHash: 'Admin@123', role: 'admin' });
  waiterUser   = await User.create({ hotelId: kdsHotel._id, name: 'Waiter', phone: '2222222222', pin: '2222', role: 'waiter', fcmToken: 'fcm-waiter-test' });

  kitchenToken = signToken(kitchenUser._id, 'kitchen');
  adminToken   = signToken(adminUser._id,   'admin');

  kdsTable = await Table.create({ hotelId: kdsHotel._id, tableNumber: 1, capacity: 4, qrToken: 'kds-qr-t1' });
  kdsItem  = await MenuItem.create({ hotelId: kdsHotel._id, name: 'Test Dish', category: 'Mains', price: 100 });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('P05 - KDS', () => {

  // ── 1 ─────────────────────────────────────────────────────────────────────
  test('GET kds/orders returns only new/accepted/preparing orders', async () => {
    // Create 5 orders in various states
    await makeOrder({ kdsStatus: 'new',       status: 'placed'   });
    await makeOrder({ kdsStatus: 'accepted',  status: 'preparing' });
    await makeOrder({ kdsStatus: 'preparing', status: 'preparing' });
    await makeOrder({ kdsStatus: 'ready',     status: 'ready'    });
    await makeOrder({ kdsStatus: 'rejected',  status: 'rejected' });

    const res = await request(app)
      .get('/api/kds')
      .set('Authorization', `Bearer ${kitchenToken}`);

    expect(res.status).toBe(200);
    const statuses = res.body.orders.map(o => o.kdsStatus);
    expect(statuses).toContain('new');
    expect(statuses).toContain('accepted');
    expect(statuses).toContain('preparing');
    expect(statuses).not.toContain('ready');
    expect(statuses).not.toContain('rejected');
  });

  // ── 2 ─────────────────────────────────────────────────────────────────────
  test('Accept updates kdsStatus and assigns waiter', async () => {
    // autoWaiterAssign=false → no waiter at placement; accept should assign one
    await User.findByIdAndUpdate(waiterUser._id, { available: true, activeOrderIds: [] });
    const order = await makeOrder({ assignedWaiterId: null });

    const res = await request(app)
      .patch(`/api/kds/${order._id}/accept`)
      .set('Authorization', `Bearer ${kitchenToken}`);

    expect(res.status).toBe(200);
    expect(res.body.order.kdsStatus).toBe('accepted');
    expect(res.body.order.status).toBe('preparing');
    expect(res.body.order.assignedWaiterId).not.toBeNull();
  });

  // ── 3 ─────────────────────────────────────────────────────────────────────
  test('Accept sends FCM to assigned waiter (mocked)', async () => {
    await User.findByIdAndUpdate(waiterUser._id, { available: true, activeOrderIds: [] });
    const order = await makeOrder({ assignedWaiterId: null });

    await request(app)
      .patch(`/api/kds/${order._id}/accept`)
      .set('Authorization', `Bearer ${kitchenToken}`);

    expect(sendToToken).toHaveBeenCalledWith(
      'fcm-waiter-test',
      expect.objectContaining({ title: expect.any(String) }),
      expect.anything()
    );
  });

  // ── 4 ─────────────────────────────────────────────────────────────────────
  test('Reject updates order and table status', async () => {
    // Set up table as occupied for this order
    await Table.findByIdAndUpdate(kdsTable._id, { status: 'occupied', currentOrderId: null });
    const order = await makeOrder({ assignedWaiterId: null });
    await Table.findByIdAndUpdate(kdsTable._id, { currentOrderId: order._id });

    const res = await request(app)
      .patch(`/api/kds/${order._id}/reject`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ reason: 'Out of stock' });

    expect(res.status).toBe(200);
    expect(res.body.order.kdsStatus).toBe('rejected');
    expect(res.body.order.status).toBe('rejected');
    expect(res.body.order.rejectionReason).toBe('Out of stock');

    const table = await Table.findById(kdsTable._id);
    expect(table.status).toBe('available');
    expect(table.currentOrderId).toBeNull();
  });

  // ── 5 ─────────────────────────────────────────────────────────────────────
  test('Reject removes orderId from waiter activeOrderIds', async () => {
    await User.findByIdAndUpdate(waiterUser._id, { available: true, activeOrderIds: [] });
    const order = await makeOrder({ assignedWaiterId: waiterUser._id });
    // Manually put order in waiter's active list
    await User.findByIdAndUpdate(waiterUser._id, { $push: { activeOrderIds: order._id } });

    await request(app)
      .patch(`/api/kds/${order._id}/reject`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ reason: 'Test' });

    const waiter = await User.findById(waiterUser._id);
    const activeIds = waiter.activeOrderIds.map(id => id.toString());
    expect(activeIds).not.toContain(order._id.toString());
  });

  // ── 6 ─────────────────────────────────────────────────────────────────────
  test('Reject emits socket event with reason', async () => {
    const order = await makeOrder({ assignedWaiterId: null });

    await request(app)
      .patch(`/api/kds/${order._id}/reject`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ reason: 'Kitchen closed' });

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'order:kds_rejected',
      expect.objectContaining({ reason: 'Kitchen closed' })
    );
  });

  // ── 7 ─────────────────────────────────────────────────────────────────────
  test('Ready emits socket event and FCM to assigned waiter', async () => {
    // Order pre-assigned to waiter (with FCM token)
    const order = await makeOrder({
      assignedWaiterId: waiterUser._id,
      kdsStatus:        'accepted',
      status:           'preparing',
    });

    const res = await request(app)
      .patch(`/api/kds/${order._id}/ready`)
      .set('Authorization', `Bearer ${kitchenToken}`);

    expect(res.status).toBe(200);
    expect(res.body.order.kdsStatus).toBe('ready');

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'order:ready',
      expect.objectContaining({ orderId: expect.anything() })
    );

    expect(sendToToken).toHaveBeenCalledWith(
      'fcm-waiter-test',
      expect.objectContaining({ body: expect.stringContaining('pick up') }),
      expect.anything()
    );
  });

  // ── 8 ─────────────────────────────────────────────────────────────────────
  test('Kitchen-role auth required on all KDS endpoints', async () => {
    const noAuth = await request(app).get('/api/kds');
    expect(noAuth.status).toBe(401);

    const fakeId = new mongoose.Types.ObjectId();
    const noAuthPatch = await request(app).patch(`/api/kds/${fakeId}/accept`);
    expect(noAuthPatch.status).toBe(401);
  });

  // ── 9 ─────────────────────────────────────────────────────────────────────
  test('Admin can also access KDS endpoints', async () => {
    const res = await request(app)
      .get('/api/kds')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.orders).toBeDefined();
  });

});
