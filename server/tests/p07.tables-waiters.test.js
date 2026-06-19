process.env.JWT_SECRET         = 'test_jwt_secret_32_characters_xxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_xxxxx';
process.env.VPS_PUBLIC_URL     = 'http://test.example.com';
process.env.UPLOADS_DIR        = require('os').tmpdir();
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
const express  = require('express');
const jwt      = require('jsonwebtoken');
const qrcode   = require('qrcode');

const { emitToHotel } = require('../src/socket/socketHandler');

const tableRoutes  = require('../src/routes/table.routes');
const waiterRoutes = require('../src/routes/waiter.routes');
const authRoutes   = require('../src/routes/auth.routes');
const errorHandler = require('../src/middleware/errorHandler');
const Hotel        = require('../src/models/Hotel');
const User         = require('../src/models/User');
const Table        = require('../src/models/Table');

// ── Test app ─────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/auth',    authRoutes);
app.use('/api/tables',  tableRoutes);
app.use('/api/waiters', waiterRoutes);
app.use(errorHandler);

// ── Fixtures ─────────────────────────────────────────────────────────────────
let mongod;
let p7Hotel, p7HotelPrivate;
let adminUser, adminToken, waiterUser, waiterToken;
let p7Table;
let waiterForTests;   // used for tests 10, 11, 12
let createdWaiter;    // set in test 8, used in test 9

function signToken(userId, role) {
  return jwt.sign({ id: userId.toString(), role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // Hotel with public table visibility ON
  p7Hotel = await Hotel.create({
    name:     'P7 Hotel',
    settings: { tableVisibilityPublic: true },
  });

  // Hotel with visibility OFF
  p7HotelPrivate = await Hotel.create({
    name:     'Private Hotel',
    settings: { tableVisibilityPublic: false },
  });

  adminUser  = await User.create({ hotelId: p7Hotel._id, name: 'Admin', email: 'admin@p7.com', passwordHash: 'Admin@123', role: 'admin' });
  waiterUser = await User.create({ hotelId: p7Hotel._id, name: 'Waiter', phone: '1111111111', pin: '1111', role: 'waiter' });

  adminToken  = signToken(adminUser._id,  'admin');
  waiterToken = signToken(waiterUser._id, 'waiter');

  // A pre-existing table for status/notes tests
  p7Table = await Table.create({ hotelId: p7Hotel._id, tableNumber: 10, capacity: 4, qrToken: 'p7-qr-t10' });

  // A second waiter (for tests 10-12: availability, delete, login-fail)
  waiterForTests = await User.create({
    hotelId: p7Hotel._id, name: 'WaiterB', phone: '2222222222', pin: '2222', role: 'waiter',
  });

  // Also create a table for p7HotelPrivate so visibility test works
  await Table.create({ hotelId: p7HotelPrivate._id, tableNumber: 1, capacity: 2, qrToken: 'priv-qr' });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('P07 - Tables & Waiters', () => {

  // ── 1 ─────────────────────────────────────────────────────────────────────
  test('Public table endpoint returns only basic info', async () => {
    const res = await request(app).get(`/api/tables/${p7Hotel._id}/public`);

    expect(res.status).toBe(200);
    expect(res.body.tables.length).toBeGreaterThan(0);
    const t = res.body.tables[0];
    expect(t.tableNumber).toBeDefined();
    expect(t.capacity).toBeDefined();
    expect(t.status).toBeDefined();
    // Notes and currentOrderId must NOT be exposed in public endpoint
    expect(t.notes).toBeUndefined();
    expect(t.currentOrderId).toBeUndefined();
    expect(t.qrToken).toBeUndefined();
  });

  // ── 2 ─────────────────────────────────────────────────────────────────────
  test('Public table endpoint returns 403 if tableVisibilityPublic is off', async () => {
    const res = await request(app).get(`/api/tables/${p7HotelPrivate._id}/public`);
    expect(res.status).toBe(403);
  });

  // ── 3 ─────────────────────────────────────────────────────────────────────
  test('Create table generates qrToken UUID', async () => {
    const res = await request(app)
      .post('/api/tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tableNumber: 20, capacity: 4 });

    expect(res.status).toBe(201);
    expect(res.body.table.qrToken).toMatch(UUID_REGEX);
  });

  // ── 4 ─────────────────────────────────────────────────────────────────────
  test('Create table saves QR PNG to UPLOADS_DIR/qr/ (mocked fs write)', async () => {
    const res = await request(app)
      .post('/api/tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tableNumber: 21, capacity: 2 });

    expect(res.status).toBe(201);
    expect(qrcode.toFile).toHaveBeenCalled();
    const [filePath] = qrcode.toFile.mock.calls[0];
    expect(filePath).toMatch(/qr/);
    expect(filePath).toMatch(/\.png$/);
  });

  // ── 5 ─────────────────────────────────────────────────────────────────────
  test('QR URL encodes correct hotel and table params', async () => {
    const res = await request(app)
      .post('/api/tables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ tableNumber: 22, capacity: 6 });

    expect(res.status).toBe(201);
    expect(qrcode.toFile).toHaveBeenCalled();
    const [, qrContent] = qrcode.toFile.mock.calls[0];
    expect(qrContent).toContain(`hotel=${p7Hotel._id}`);
    expect(qrContent).toContain('table=');
    expect(qrContent).toContain('http://frontend.test/menu');
  });

  // ── 6 ─────────────────────────────────────────────────────────────────────
  test('Table status update emits socket event', async () => {
    const res = await request(app)
      .patch(`/api/tables/${p7Table._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'reserved', reservedFor: 'Smith Party' });

    expect(res.status).toBe(200);
    expect(res.body.table.status).toBe('reserved');

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'table:status',
      expect.objectContaining({ status: 'reserved' })
    );
  });

  // ── 7 ─────────────────────────────────────────────────────────────────────
  test('Add note to table saves correctly', async () => {
    const res = await request(app)
      .post(`/api/tables/${p7Table._id}/notes`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ text: 'VIP customer', tag: 'vip' });

    expect(res.status).toBe(200);
    const note = res.body.table.notes.find(n => n.text === 'VIP customer');
    expect(note).toBeDefined();
    expect(note.tag).toBe('vip');
    expect(note.addedBy.toString()).toBe(adminUser._id.toString());
  });

  // ── 8 ─────────────────────────────────────────────────────────────────────
  test('Create waiter hashes PIN before saving', async () => {
    const res = await request(app)
      .post('/api/waiters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Waiter', phone: '3333333333', pin: '9876', role: 'waiter' });

    expect(res.status).toBe(201);
    createdWaiter = res.body.user;

    // Fetch raw user to inspect hashed pin
    const raw = await User.findById(createdWaiter._id);
    expect(raw.pin).toMatch(/^\$2/);          // bcrypt hash
    expect(raw.pin).not.toBe('9876');         // plain PIN must NOT be stored
  });

  // ── 9 ─────────────────────────────────────────────────────────────────────
  test('Waiter login with correct PIN succeeds after creation', async () => {
    const res = await request(app)
      .post('/api/auth/waiter/login')
      .send({ pin: '9876', hotelId: p7Hotel._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.name).toBe('New Waiter');
  });

  // ── 10 ────────────────────────────────────────────────────────────────────
  test('Toggle waiter availability updates DB and emits socket', async () => {
    const res = await request(app)
      .patch(`/api/waiters/${waiterForTests._id}/availability`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ available: false });

    expect(res.status).toBe(200);
    expect(res.body.user.available).toBe(false);

    const db = await User.findById(waiterForTests._id);
    expect(db.available).toBe(false);

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'waiter:availability',
      expect.objectContaining({ available: false })
    );
  });

  // ── 11 ────────────────────────────────────────────────────────────────────
  test('Soft delete sets isActive to false', async () => {
    const res = await request(app)
      .delete(`/api/waiters/${waiterForTests._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const db = await User.findById(waiterForTests._id);
    expect(db.isActive).toBe(false);
  });

  // ── 12 ────────────────────────────────────────────────────────────────────
  test('Deleted waiter cannot login', async () => {
    // waiterForTests is now isActive=false after test 11
    const res = await request(app)
      .post('/api/auth/waiter/login')
      .send({ pin: '2222', hotelId: p7Hotel._id.toString() });

    expect(res.status).toBe(401);
  });

  // ── 13 ────────────────────────────────────────────────────────────────────
  test('Admin can view waiter order history', async () => {
    const res = await request(app)
      .get(`/api/waiters/${waiterUser._id}/orders`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.orders)).toBe(true);
  });

});
