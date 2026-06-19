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

const feedbackRoutes = require('../src/routes/feedback.routes');
const errorHandler   = require('../src/middleware/errorHandler');
const Hotel          = require('../src/models/Hotel');
const User           = require('../src/models/User');
const Table          = require('../src/models/Table');
const MenuItem       = require('../src/models/MenuItem');
const Order          = require('../src/models/Order');
const Feedback       = require('../src/models/Feedback');

// ── Test app ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/feedback', feedbackRoutes);
app.use(errorHandler);

// ── Fixtures ──────────────────────────────────────────────────────────────────
let mongod;
let p8Hotel;
let adminUser, adminToken;
let waiterA, waiterAToken;
let waiterB;
let table1, menuItem1;
let order1, orderValidation, orderRolling, orderForB;

function signToken(userId, role) {
  return jwt.sign({ id: userId.toString(), role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function makeOrder(hotelId, tableId, sessionId, waiterId, menuItemId) {
  return Order.create({
    hotelId,
    tableId,
    tableNumber: 1,
    sessionId,
    assignedWaiterId: waiterId || null,
    items: [{
      menuItemId,
      name:     'Test Dish',
      price:    100,
      quantity: 1,
    }],
    bill: { subtotal: 100, cgst: 0, sgst: 0, total: 100 },
  });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  p8Hotel = await Hotel.create({ name: 'P8 Hotel', gstEnabled: false });

  adminUser = await User.create({
    hotelId: p8Hotel._id, name: 'Admin', email: 'admin@p8.com',
    passwordHash: 'Admin@123', role: 'admin',
  });
  adminToken = signToken(adminUser._id, 'admin');

  waiterA = await User.create({
    hotelId: p8Hotel._id, name: 'Waiter Alpha', phone: '1111111111', pin: '1111', role: 'waiter',
  });
  waiterAToken = signToken(waiterA._id, 'waiter');

  waiterB = await User.create({
    hotelId: p8Hotel._id, name: 'Waiter Beta', phone: '2222222222', pin: '2222', role: 'waiter',
  });

  table1 = await Table.create({
    hotelId: p8Hotel._id, tableNumber: 1, capacity: 4, qrToken: 'p8-qr-t1',
  });

  menuItem1 = await MenuItem.create({
    hotelId: p8Hotel._id, name: 'Test Dish', price: 100,
    category: 'Mains', isVeg: true, isAvailable: true,
  });

  // Orders for each test scenario
  order1          = await makeOrder(p8Hotel._id, table1._id, 'sess-1',        waiterA._id, menuItem1._id);
  orderValidation = await makeOrder(p8Hotel._id, table1._id, 'sess-v',        waiterA._id, menuItem1._id);
  orderRolling    = await makeOrder(p8Hotel._id, table1._id, 'sess-rolling',  waiterA._id, menuItem1._id);
  orderForB       = await makeOrder(p8Hotel._id, table1._id, 'sess-b',        waiterB._id, menuItem1._id);

  // Pre-existing feedback with old date (for date range filter test)
  const orderOld = await makeOrder(p8Hotel._id, table1._id, 'sess-old', null, menuItem1._id);
  await Feedback.create({
    hotelId:     p8Hotel._id,
    orderId:     orderOld._id,
    tableId:     table1._id,
    ratings:     { overall: 3 },
    submittedAt: new Date('2024-01-15'),
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('P08 - Feedback', () => {

  // ── 1 ──────────────────────────────────────────────────────────────────────
  test('POST feedback creates document correctly', async () => {
    const res = await request(app)
      .post('/api/feedback')
      .send({
        orderId:   order1._id.toString(),
        sessionId: 'sess-1',
        ratings:   { overall: 5, waiter: 4, food: 4 },
        comment:   'Great service',
      });

    expect(res.status).toBe(201);
    expect(res.body.feedback._id).toBeDefined();
    expect(res.body.feedback.hotelId.toString()).toBe(p8Hotel._id.toString());
    expect(res.body.feedback.orderId.toString()).toBe(order1._id.toString());
    expect(res.body.feedback.ratings.overall).toBe(5);
    expect(res.body.feedback.comment).toBe('Great service');
  });

  // ── 2 ──────────────────────────────────────────────────────────────────────
  test('POST feedback validates ratings 1-5', async () => {
    const base = { orderId: orderValidation._id.toString(), sessionId: 'sess-v' };

    const res1 = await request(app)
      .post('/api/feedback')
      .send({ ...base, ratings: { overall: 0 } });
    expect(res1.status).toBe(400);

    const res2 = await request(app)
      .post('/api/feedback')
      .send({ ...base, ratings: { overall: 6 } });
    expect(res2.status).toBe(400);
  });

  // ── 3 ──────────────────────────────────────────────────────────────────────
  test('POST feedback prevents duplicate feedback per order', async () => {
    // order1 already has feedback from test 1
    const res = await request(app)
      .post('/api/feedback')
      .send({
        orderId:   order1._id.toString(),
        sessionId: 'sess-1',
        ratings:   { overall: 5 },
      });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already submitted/i);
  });

  // ── 4 ──────────────────────────────────────────────────────────────────────
  test('POST feedback updates waiter avgRating correctly', async () => {
    // waiterA received waiter rating=4 in test 1
    const waiter = await User.findById(waiterA._id);
    expect(waiter.stats.avgRating).toBe(4);
    expect(waiter.stats.ratingCount).toBe(1);
  });

  // ── 5 ──────────────────────────────────────────────────────────────────────
  test('Rolling average calculation is correct', async () => {
    // Submit second feedback for orderRolling with waiter rating=2
    // Rolling: (4 * 1 + 2) / (1 + 1) = 3
    const res = await request(app)
      .post('/api/feedback')
      .send({
        orderId:   orderRolling._id.toString(),
        sessionId: 'sess-rolling',
        ratings:   { overall: 4, waiter: 2 },
      });

    expect(res.status).toBe(201);

    const waiter = await User.findById(waiterA._id);
    expect(waiter.stats.ratingCount).toBe(2);
    expect(waiter.stats.avgRating).toBe(3);
  });

  // ── 6 ──────────────────────────────────────────────────────────────────────
  test('Admin can filter feedback by waiter', async () => {
    // Create feedback for waiterB
    await request(app)
      .post('/api/feedback')
      .send({
        orderId:   orderForB._id.toString(),
        sessionId: 'sess-b',
        ratings:   { overall: 5, waiter: 5 },
      });

    // Filter to only waiterA's feedbacks
    const res = await request(app)
      .get(`/api/feedback/admin/all?waiterId=${waiterA._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.feedbacks.length).toBeGreaterThanOrEqual(1);
    res.body.feedbacks.forEach(f => {
      expect(f.waiterId._id.toString()).toBe(waiterA._id.toString());
    });
  });

  // ── 7 ──────────────────────────────────────────────────────────────────────
  test('Admin can filter feedback by date range', async () => {
    // dateFrom=2025-01-01 should exclude the pre-created 2024 feedback
    const res = await request(app)
      .get('/api/feedback/admin/all?dateFrom=2025-01-01')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    res.body.feedbacks.forEach(f => {
      expect(new Date(f.submittedAt).getFullYear()).toBeGreaterThanOrEqual(2025);
    });
    // The 2024 feedback should NOT appear
    const has2024 = res.body.feedbacks.some(
      f => new Date(f.submittedAt).getFullYear() < 2025
    );
    expect(has2024).toBe(false);
  });

  // ── 8 ──────────────────────────────────────────────────────────────────────
  test('Waiter leaderboard sorted by avgRating DESC', async () => {
    // waiterA avgRating=3 (from tests 1+5), waiterB avgRating=5 (from test 6)
    const res = await request(app)
      .get('/api/feedback/admin/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const lb = res.body.waiterLeaderboard;
    expect(lb.length).toBeGreaterThanOrEqual(2);
    // First entry has highest avgRating
    for (let i = 0; i < lb.length - 1; i++) {
      expect(lb[i].stats.avgRating).toBeGreaterThanOrEqual(lb[i + 1].stats.avgRating);
    }
    expect(lb[0].name).toBe('Waiter Beta');
  });

  // ── 9 ──────────────────────────────────────────────────────────────────────
  test('Waiter can view only own feedback', async () => {
    const res = await request(app)
      .get('/api/feedback/waiter/mine')
      .set('Authorization', `Bearer ${waiterAToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.myFeedbacks)).toBe(true);
    // All returned feedbacks should belong to waiterA
    res.body.myFeedbacks.forEach(f => {
      expect(f.waiterId.toString()).toBe(waiterA._id.toString());
    });
    expect(res.body.myStats.avgRating).toBe(3);
    expect(res.body.myStats.totalReviews).toBe(2);
    expect(res.body.myStats.ratingBreakdown).toBeDefined();
  });

  // ── 10 ─────────────────────────────────────────────────────────────────────
  test('Hotel summary returns correct totals', async () => {
    const res = await request(app)
      .get(`/api/feedback/hotel/${p8Hotel._id}/summary`);

    expect(res.status).toBe(200);
    // Pre-created old (overall=3) + test1 (overall=5) + test5 (overall=4) + test6 (overall=5) = 4 reviews
    // avg = (3+5+4+5)/4 = 4.25
    expect(res.body.totalReviews).toBe(4);
    expect(res.body.avgOverall).toBe(4.25);
  });

});
