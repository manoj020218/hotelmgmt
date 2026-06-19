process.env.JWT_SECRET          = 'test_jwt_secret_32_characters_xxxx';
process.env.JWT_REFRESH_SECRET  = 'test_refresh_secret_32_chars_xxxxx';
process.env.JWT_ACCESS_EXPIRES  = '15m';
process.env.JWT_REFRESH_EXPIRES = '7d';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request  = require('supertest');
const express  = require('express');
const jwt      = require('jsonwebtoken');

const authRoutes    = require('../src/routes/auth.routes');
const auth          = require('../src/middleware/auth');
const guard         = require('../src/middleware/roleGuard');
const errorHandler  = require('../src/middleware/errorHandler');
const Hotel         = require('../src/models/Hotel');
const User          = require('../src/models/User');

// ── Minimal test app ───────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Guarded test routes used for roleGuard tests
app.get('/test/admin-only',       auth, guard('admin'),           (_req, res) => res.json({ ok: true }));
app.get('/test/waiter-or-admin',  auth, guard('waiter', 'admin'), (_req, res) => res.json({ ok: true }));

app.use(errorHandler);

// ── Fixtures ────────────────────────────────────────────────────────────────
let mongod, hotel, adminUser, waiterUser;
const ADMIN_PASSWORD = 'Admin@123';
const WAITER_PIN     = '1234';

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  hotel = await Hotel.create({ name: 'Test Hotel', gstEnabled: false });

  adminUser = await User.create({
    hotelId:      hotel._id,
    name:         'Test Admin',
    email:        'admin@test.com',
    passwordHash: ADMIN_PASSWORD,
    role:         'admin',
  });

  waiterUser = await User.create({
    hotelId: hotel._id,
    name:    'Test Waiter',
    phone:   '9999999999',
    pin:     WAITER_PIN,
    role:    'waiter',
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

// ── Tests ────────────────────────────────────────────────────────────────────
describe('P02 - Auth', () => {

  test('Admin login returns valid JWT with correct role', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@test.com', password: ADMIN_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.id).toBe(adminUser._id.toString());

    // Decode and verify token claims
    const decoded = jwt.verify(res.body.accessToken, process.env.JWT_SECRET);
    expect(decoded.role).toBe('admin');
  });

  test('Admin login fails with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@test.com', password: 'WrongPass' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('Admin login fails with unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'nobody@test.com', password: ADMIN_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('Waiter login succeeds with correct PIN', async () => {
    const res = await request(app)
      .post('/api/auth/waiter/login')
      .send({ pin: WAITER_PIN, hotelId: hotel._id.toString() });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.role).toBe('waiter');
    expect(res.body.user.name).toBe('Test Waiter');
  });

  test('Waiter login fails with wrong PIN', async () => {
    const res = await request(app)
      .post('/api/auth/waiter/login')
      .send({ pin: '0000', hotelId: hotel._id.toString() });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  test('Refresh token returns new access token', async () => {
    // First login to get tokens
    const loginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@test.com', password: ADMIN_PASSWORD });

    const { refreshToken } = loginRes.body;

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();

    // Verify new token is valid
    const decoded = jwt.verify(refreshRes.body.accessToken, process.env.JWT_SECRET);
    expect(decoded.role).toBe('admin');
  });

  test('Expired access token is rejected by auth middleware', async () => {
    // Create a token that is already expired (exp in the past)
    const expiredToken = jwt.sign(
      { id: adminUser._id.toString(), role: 'admin', exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  test('roleGuard blocks waiter from admin route', async () => {
    const loginRes = await request(app)
      .post('/api/auth/waiter/login')
      .send({ pin: WAITER_PIN, hotelId: hotel._id.toString() });

    const { accessToken } = loginRes.body;

    const res = await request(app)
      .get('/test/admin-only')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });

  test('roleGuard allows admin on waiter route if listed', async () => {
    const loginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@test.com', password: ADMIN_PASSWORD });

    const { accessToken } = loginRes.body;

    const res = await request(app)
      .get('/test/waiter-or-admin')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('FCM token saved to user document', async () => {
    const loginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@test.com', password: ADMIN_PASSWORD });

    const { accessToken } = loginRes.body;
    const fcmToken = 'fcm-test-token-abc123';

    const res = await request(app)
      .post('/api/auth/fcm-token')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ fcmToken });

    expect(res.status).toBe(200);

    const updated = await User.findById(adminUser._id);
    expect(updated.fcmToken).toBe(fcmToken);
  });

  test('/me returns correct user data', async () => {
    const loginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@test.com', password: ADMIN_PASSWORD });

    const { accessToken } = loginRes.body;

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Test Admin');
    expect(res.body.user.role).toBe('admin');
    // Sensitive fields must not be returned
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.pin).toBeUndefined();
    expect(res.body.user.refreshToken).toBeUndefined();
  });

  test('Logout invalidates refresh token', async () => {
    // Login
    const loginRes = await request(app)
      .post('/api/auth/admin/login')
      .send({ email: 'admin@test.com', password: ADMIN_PASSWORD });

    const { accessToken, refreshToken } = loginRes.body;

    // Logout
    const logoutRes = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(logoutRes.status).toBe(200);

    // Try to use refresh token — must now fail
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });

    expect(refreshRes.status).toBe(401);
  });

});
