const os   = require('os');
const path = require('path');
const fs   = require('fs');

const TEST_UPLOADS = path.join(os.tmpdir(), `hotel-qr-p11-${Date.now()}`);
process.env.UPLOADS_DIR        = TEST_UPLOADS;
process.env.JWT_SECRET         = 'test_jwt_secret_32_characters_xxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_xxxxx';
process.env.VPS_PUBLIC_URL     = 'http://test.example.com';
process.env.FRONTEND_URL       = 'http://frontend.test';

jest.mock('../src/socket/socketHandler', () => ({
  initSocket:  jest.fn(),
  emitToHotel: jest.fn(),
  emitToOrder: jest.fn(),
}));
jest.mock('qrcode', () => ({
  toFile: jest.fn().mockResolvedValue(undefined),
}));

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request  = require('supertest');

const { emitToHotel } = require('../src/socket/socketHandler');
const { createApp }   = require('../src/index');

const Hotel    = require('../src/models/Hotel');
const User     = require('../src/models/User');
const Table    = require('../src/models/Table');
const MenuItem = require('../src/models/MenuItem');
const Order    = require('../src/models/Order');
const Payment  = require('../src/models/Payment');

const app = createApp();

// ── Shared state ──────────────────────────────────────────────────────────────
let mongod;
let hotel, adminUser, waiterUser, kitchenUser;
let table, menuItem;
let adminToken, waiterToken, kitchenToken;
let menuItemId;
let orderId, sessionId, paymentId;

beforeAll(async () => {
  ['menu', 'qr', 'receipts', 'upi'].forEach(sub =>
    fs.mkdirSync(path.join(TEST_UPLOADS, sub), { recursive: true })
  );

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  hotel = await Hotel.create({
    name:        'Integration Hotel',
    gstEnabled:  true,
    cgstPercent: 5,
    sgstPercent: 5,
    settings: { autoWaiterAssign: true, kdsEnabled: true },
  });

  adminUser = await User.create({
    hotelId: hotel._id, name: 'Admin', email: 'admin@int.com',
    passwordHash: 'Admin@123', role: 'admin',
  });
  waiterUser = await User.create({
    hotelId: hotel._id, name: 'Waiter One', phone: '1111111111',
    pin: '5555', role: 'waiter', available: true,
  });
  kitchenUser = await User.create({
    hotelId: hotel._id, name: 'Chef One', phone: '2222222222', pin: '6666', role: 'kitchen',
  });

  table = await Table.create({
    hotelId: hotel._id, tableNumber: 5, capacity: 4, qrToken: 'int-qr-t5',
  });
  menuItem = await MenuItem.create({
    hotelId: hotel._id, name: 'Butter Chicken', price: 200,
    category: 'Mains', isVeg: false, available: true,
  });

  const jwt = require('jsonwebtoken');
  adminToken   = jwt.sign({ id: adminUser._id.toString(),   role: 'admin'   }, process.env.JWT_SECRET, { expiresIn: '1h' });
  waiterToken  = jwt.sign({ id: waiterUser._id.toString(),  role: 'waiter'  }, process.env.JWT_SECRET, { expiresIn: '1h' });
  kitchenToken = jwt.sign({ id: kitchenUser._id.toString(), role: 'kitchen' }, process.env.JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  fs.rmSync(TEST_UPLOADS, { recursive: true, force: true });
});

// ── Integration Flows ─────────────────────────────────────────────────────────
describe('P11 - Full Integration', () => {

  // ── FLOW 1 ─────────────────────────────────────────────────────────────────
  test('FLOW 1: Admin logs in and creates a menu item', async () => {
    emitToHotel.mockClear();

    const loginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@int.com', password: 'Admin@123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeDefined();
    adminToken = loginRes.body.accessToken;

    const menuRes = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name',     'Paneer Tikka')
      .field('price',    '150')
      .field('category', 'Starters')
      .field('isVeg',    'true');

    expect(menuRes.status).toBe(201);
    menuItemId = menuRes.body.item._id;
    expect(menuItemId).toBeDefined();
  });

  // ── FLOW 2 ─────────────────────────────────────────────────────────────────
  test('FLOW 2: Customer scans QR and sees menu', async () => {
    const res = await request(app).get(`/api/menu/${hotel._id}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
    const names = res.body.items.map(i => i.name);
    expect(names).toContain('Butter Chicken');
    expect(names).toContain('Paneer Tikka');
  });

  // ── FLOW 3 ─────────────────────────────────────────────────────────────────
  test('FLOW 3: Customer places order, bill calculated with GST', async () => {
    emitToHotel.mockClear();

    const res = await request(app)
      .post('/api/orders')
      .send({
        tableQrToken: 'int-qr-t5',
        items: [{ menuItemId: menuItem._id.toString(), quantity: 2 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.orderId).toBeDefined();
    expect(res.body.sessionId).toBeDefined();
    orderId   = res.body.orderId;
    sessionId = res.body.sessionId;

    // GST: 2×200=400, 5%+5%=10% → total=440, cgst=sgst=20
    expect(res.body.bill.cgst).toBeGreaterThan(0);
    expect(res.body.bill.sgst).toBeGreaterThan(0);
    expect(res.body.bill.total).toBe(440);

    // Socket fired order:new to hotel room
    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'order:new',
      expect.objectContaining({ orderId: expect.anything(), tableNumber: 5 })
    );
  });

  // ── FLOW 4 ─────────────────────────────────────────────────────────────────
  test('FLOW 4: Waiter gets assigned and order:new socket fires', async () => {
    // Waiter auto-assigned — verify in DB
    const dbOrder = await Order.findById(orderId);
    expect(dbOrder).not.toBeNull();
    expect(dbOrder.assignedWaiterId).not.toBeNull();
    expect(dbOrder.assignedWaiterId.toString()).toBe(waiterUser._id.toString());
    expect(dbOrder.status).toBe('assigned');
  });

  // ── FLOW 5 ─────────────────────────────────────────────────────────────────
  test('FLOW 5: KDS receives order:new event', async () => {
    // KDS can see the order in its queue
    const res = await request(app)
      .get('/api/kds')
      .set('Authorization', `Bearer ${kitchenToken}`);

    expect(res.status).toBe(200);
    const found = res.body.orders.find(o => o._id.toString() === orderId.toString());
    expect(found).toBeDefined();
    expect(found.kdsStatus).toBe('new');
  });

  // ── FLOW 6 ─────────────────────────────────────────────────────────────────
  test('FLOW 6: KDS accepts order, waiter notified', async () => {
    emitToHotel.mockClear();

    const res = await request(app)
      .patch(`/api/kds/${orderId}/accept`)
      .set('Authorization', `Bearer ${kitchenToken}`);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('preparing');
    expect(res.body.order.kdsStatus).toBe('accepted');

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'order:kds_accepted',
      expect.objectContaining({ tableNumber: 5 })
    );
  });

  // ── FLOW 7 ─────────────────────────────────────────────────────────────────
  test('FLOW 7: KDS marks ready, waiter notified via socket', async () => {
    emitToHotel.mockClear();

    const res = await request(app)
      .patch(`/api/kds/${orderId}/ready`)
      .set('Authorization', `Bearer ${kitchenToken}`);

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('ready');
    expect(res.body.order.kdsStatus).toBe('ready');

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'order:ready',
      expect.objectContaining({ tableNumber: 5 })
    );
  });

  // ── FLOW 8 ─────────────────────────────────────────────────────────────────
  test('FLOW 8: Waiter marks served, table becomes available', async () => {
    emitToHotel.mockClear();

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ status: 'served' });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe('served');

    // Table freed
    const t = await Table.findById(table._id);
    expect(t.status).toBe('available');

    // Payment created automatically
    expect(res.body.payment).toBeDefined();
    paymentId = res.body.payment._id.toString();

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'order:served',
      expect.objectContaining({ tableNumber: 5 })
    );
  });

  // ── FLOW 9 ─────────────────────────────────────────────────────────────────
  test('FLOW 9: Customer pays via UPI, payment marked received', async () => {
    emitToHotel.mockClear();

    const res = await request(app)
      .patch(`/api/payments/${paymentId}/mark-received`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ method: 'upi', upiRef: 'UPI123456' });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('received');
    expect(res.body.payment.method).toBe('upi');

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'payment:received',
      expect.objectContaining({ amount: 440 })
    );
  });

  // ── FLOW 10 ────────────────────────────────────────────────────────────────
  test('FLOW 10: Receipt PDF generated and URL returned', async () => {
    const payment = await Payment.findById(paymentId);
    expect(payment.receiptUrl).toBeDefined();
    expect(payment.receiptUrl).toContain('/uploads/receipts/');

    const filename = path.basename(payment.receiptUrl);
    const filePath = path.join(TEST_UPLOADS, 'receipts', filename);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(100);
  });

  // ── FLOW 11 ────────────────────────────────────────────────────────────────
  test('FLOW 11: Customer submits feedback, waiter rating updated', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({
        orderId,
        sessionId,
        ratings: { overall: 5, waiter: 5, food: 4 },
        comment: 'Excellent food and service!',
      });

    expect(res.status).toBe(201);
    expect(res.body.feedback.ratings.overall).toBe(5);

    const waiter = await User.findById(waiterUser._id);
    expect(waiter.stats.ratingCount).toBe(1);
    expect(waiter.stats.avgRating).toBe(5);
  });

  // ── FLOW 12 ────────────────────────────────────────────────────────────────
  test('FLOW 12: Analytics dashboard shows correct revenue', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard?period=today')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.revenue.total).toBe(440);
    expect(res.body.orders.byStatus.served).toBe(1);
  });

  // ── ERROR: unavailable item ─────────────────────────────────────────────────
  test('ORDER: Reject unavailable item gracefully', async () => {
    await MenuItem.findByIdAndUpdate(menuItem._id, { available: false });

    const res = await request(app)
      .post('/api/orders')
      .send({
        tableQrToken: 'int-qr-t5',
        items: [{ menuItemId: menuItem._id.toString(), quantity: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/unavailable/i);

    await MenuItem.findByIdAndUpdate(menuItem._id, { available: true });
  });

  // ── ERROR: KDS reject ───────────────────────────────────────────────────────
  test('KDS: Reject order updates customer and table correctly', async () => {
    emitToHotel.mockClear();

    // Place a fresh order (table is available after Flow 8)
    const orderRes = await request(app)
      .post('/api/orders')
      .send({
        tableQrToken: 'int-qr-t5',
        items: [{ menuItemId: menuItem._id.toString(), quantity: 1 }],
      });
    expect(orderRes.status).toBe(201);
    const newOrderId = orderRes.body.orderId;

    const rejectRes = await request(app)
      .patch(`/api/kds/${newOrderId}/reject`)
      .set('Authorization', `Bearer ${kitchenToken}`)
      .send({ reason: 'Out of stock' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.order.status).toBe('rejected');
    expect(rejectRes.body.order.kdsStatus).toBe('rejected');

    const t = await Table.findById(table._id);
    expect(t.status).toBe('available');

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'order:kds_rejected',
      expect.objectContaining({ reason: 'Out of stock' })
    );
  });

  // ── ERROR: Payment dispute ──────────────────────────────────────────────────
  test('PAYMENT: Dispute flow marks payment as disputed', async () => {
    const res = await request(app)
      .post(`/api/payments/${paymentId}/dispute`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Customer claims wrong amount' });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('disputed');

    const dbPayment = await Payment.findById(paymentId);
    expect(dbPayment.status).toBe('disputed');
  });

  // ── SOCKET: Reconnect ───────────────────────────────────────────────────────
  test('SOCKET: Reconnect resumes correct room subscriptions', () => {
    const realHandler = jest.requireActual('../src/socket/socketHandler');

    const joinedRooms = [];
    const mockSocket = {
      on: (event, cb) => {
        if (event === 'join:hotel') cb(hotel._id.toString());
        if (event === 'join:order') cb(orderId.toString());
      },
      join: (room) => joinedRooms.push(room),
    };
    const mockIo = {
      on: (event, cb) => { if (event === 'connection') cb(mockSocket); },
      to: () => ({ emit: jest.fn() }),
    };

    realHandler.initSocket(mockIo);

    expect(joinedRooms).toContain(`hotel:${hotel._id}`);
    expect(joinedRooms).toContain(`order:${orderId}`);
  });

});
