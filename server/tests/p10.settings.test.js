const os   = require('os');
const path = require('path');
const fs   = require('fs');

// Must set UPLOADS_DIR before requiring storage/routes
const TEST_UPLOADS = path.join(os.tmpdir(), `hotel-qr-settings-${Date.now()}`);
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

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request  = require('supertest');
const express  = require('express');
const jwt      = require('jsonwebtoken');

const { emitToHotel } = require('../src/socket/socketHandler');

const settingsRoutes = require('../src/routes/settings.routes');
const errorHandler   = require('../src/middleware/errorHandler');
const Hotel          = require('../src/models/Hotel');
const User           = require('../src/models/User');

// ── Test app ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/settings', settingsRoutes);
app.use(errorHandler);

// ── Fixtures ──────────────────────────────────────────────────────────────────
let mongod;
let p10Hotel;
let adminUser, adminToken;
let waiterUser, waiterToken;

const FAKE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

function signToken(userId, role) {
  return jwt.sign({ id: userId.toString(), role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

beforeAll(async () => {
  // Create upload subdirs
  fs.mkdirSync(path.join(TEST_UPLOADS, 'upi'), { recursive: true });

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  p10Hotel = await Hotel.create({
    name: 'P10 Hotel',
    settings: { kdsEnabled: true, kitchenOpen: true },
  });

  adminUser = await User.create({
    hotelId: p10Hotel._id, name: 'Admin', email: 'admin@p10.com',
    passwordHash: 'Admin@123', role: 'admin',
  });
  waiterUser = await User.create({
    hotelId: p10Hotel._id, name: 'Waiter', phone: '1111111111', pin: '1111', role: 'waiter',
  });

  adminToken  = signToken(adminUser._id, 'admin');
  waiterToken = signToken(waiterUser._id, 'waiter');
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  fs.rmSync(TEST_UPLOADS, { recursive: true, force: true });
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('P10 - Settings', () => {

  // ── 1 ──────────────────────────────────────────────────────────────────────
  test('GET settings returns full hotel config', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.hotel._id.toString()).toBe(p10Hotel._id.toString());
    expect(res.body.hotel.name).toBe('P10 Hotel');
    expect(res.body.hotel.settings).toBeDefined();
    expect(res.body.hotel.gstEnabled).toBeDefined();
  });

  // ── 2 ──────────────────────────────────────────────────────────────────────
  test('PATCH gst enables/disables correctly', async () => {
    // Enable GST with custom rates
    const resOn = await request(app)
      .patch('/api/settings/gst')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gstEnabled: true, cgstPercent: 5, sgstPercent: 5 });

    expect(resOn.status).toBe(200);
    expect(resOn.body.hotel.gstEnabled).toBe(true);
    expect(resOn.body.hotel.cgstPercent).toBe(5);

    // Disable GST
    const resOff = await request(app)
      .patch('/api/settings/gst')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ gstEnabled: false });

    expect(resOff.status).toBe(200);
    expect(resOff.body.hotel.gstEnabled).toBe(false);
  });

  // ── 3 ──────────────────────────────────────────────────────────────────────
  test('PATCH gst validates percent is 0-50', async () => {
    const resMinus = await request(app)
      .patch('/api/settings/gst')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cgstPercent: -1 });

    expect(resMinus.status).toBe(400);
    expect(resMinus.body.error).toMatch(/cgstPercent/i);

    const resOver = await request(app)
      .patch('/api/settings/gst')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cgstPercent: 51 });

    expect(resOver.status).toBe(400);

    // Valid value succeeds
    const resOk = await request(app)
      .patch('/api/settings/gst')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cgstPercent: 25 });

    expect(resOk.status).toBe(200);
    expect(resOk.body.hotel.cgstPercent).toBe(25);
  });

  // ── 4 ──────────────────────────────────────────────────────────────────────
  test('PATCH operations kdsEnabled emits socket', async () => {
    // kdsEnabled is currently true → set to false → should emit
    const res = await request(app)
      .patch('/api/settings/operations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ kdsEnabled: false });

    expect(res.status).toBe(200);
    expect(res.body.hotel.settings.kdsEnabled).toBe(false);

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'settings:kds',
      expect.objectContaining({ kdsEnabled: false })
    );
  });

  // ── 5 ──────────────────────────────────────────────────────────────────────
  test('PATCH kitchen close emits kitchen:closed socket', async () => {
    const res = await request(app)
      .patch('/api/settings/kitchen')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ kitchenOpen: false });

    expect(res.status).toBe(200);
    expect(res.body.hotel.settings.kitchenOpen).toBe(false);

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'kitchen:closed',
      expect.objectContaining({ kitchenOpen: false })
    );
  });

  // ── 6 ──────────────────────────────────────────────────────────────────────
  test('PATCH kitchen open emits kitchen:open socket', async () => {
    // Kitchen is currently closed from test 5
    const res = await request(app)
      .patch('/api/settings/kitchen')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ kitchenOpen: true });

    expect(res.status).toBe(200);
    expect(res.body.hotel.settings.kitchenOpen).toBe(true);

    expect(emitToHotel).toHaveBeenCalledWith(
      expect.anything(),
      'kitchen:open',
      expect.objectContaining({ kitchenOpen: true })
    );
  });

  // ── 7 ──────────────────────────────────────────────────────────────────────
  test('PATCH hotel validates phone format', async () => {
    // Invalid phone (contains letters)
    const resBad = await request(app)
      .patch('/api/settings/hotel')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: 'not-a-phone' });

    expect(resBad.status).toBe(400);
    expect(resBad.body.error).toMatch(/phone/i);

    // Valid phone
    const resOk = await request(app)
      .patch('/api/settings/hotel')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated Hotel', phone: '+91-9876543210' });

    expect(resOk.status).toBe(200);
    expect(resOk.body.hotel.phone).toBe('+91-9876543210');
    expect(resOk.body.hotel.name).toBe('Updated Hotel');
  });

  // ── 8 ──────────────────────────────────────────────────────────────────────
  test('Non-admin cannot access settings', async () => {
    const res = await request(app)
      .get('/api/settings')
      .set('Authorization', `Bearer ${waiterToken}`);

    expect(res.status).toBe(403);
  });

  // ── 9 ──────────────────────────────────────────────────────────────────────
  test('UPI QR upload saves file to UPLOADS_DIR/upi/ and URL to hotel document', async () => {
    const res = await request(app)
      .post('/api/settings/upi-qr')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('qrImage', FAKE_PNG, { filename: 'upi-qr.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.upiQrUrl).toContain('/uploads/upi/');
    expect(res.body.upiQrUrl).toMatch(/\.png$/);

    // File exists on disk
    const filename = path.basename(res.body.upiQrUrl);
    const filePath = path.join(TEST_UPLOADS, 'upi', filename);
    expect(fs.existsSync(filePath)).toBe(true);

    // Hotel document updated
    const hotel = await Hotel.findById(p10Hotel._id);
    expect(hotel.upiQrUrl).toBe(res.body.upiQrUrl);
  });

});
