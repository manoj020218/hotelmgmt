process.env.JWT_SECRET         = 'test_jwt_secret_32_characters_xxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_xxxxx';
process.env.VPS_PUBLIC_URL     = 'http://test.example.com';

const os   = require('os');
const fs   = require('fs');
const path = require('path');

// Must be set before storage.js is required so multer destination picks it up at request time
const TEST_UPLOADS = path.join(os.tmpdir(), `hotel-qr-menu-${Date.now()}`);
process.env.UPLOADS_DIR = TEST_UPLOADS;

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request  = require('supertest');
const express  = require('express');
const jwt      = require('jsonwebtoken');

const menuRoutes   = require('../src/routes/menu.routes');
const errorHandler = require('../src/middleware/errorHandler');
const Hotel        = require('../src/models/Hotel');
const User         = require('../src/models/User');
const MenuItem     = require('../src/models/MenuItem');

// ── Test app ─────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/menu', menuRoutes);
app.use(errorHandler);

// ── Fixtures ─────────────────────────────────────────────────────────────────
let mongod, hotel, adminUser, adminToken;
let itemStarter1, itemStarter2, itemMain, itemUnavailable;

// Minimal 4-byte JPEG header; multer checks extension only, not content
const FAKE_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

function signToken(userId, role) {
  return jwt.sign({ id: userId.toString(), role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

beforeAll(async () => {
  // Prepare upload directories so multer can write
  ['menu', 'upi', 'qr', 'receipts'].forEach(sub =>
    fs.mkdirSync(path.join(TEST_UPLOADS, sub), { recursive: true })
  );

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  hotel = await Hotel.create({ name: 'Test Hotel', gstEnabled: false });

  adminUser = await User.create({
    hotelId:      hotel._id,
    name:         'Test Admin',
    email:        'admin@test.com',
    passwordHash: 'Admin@123',
    role:         'admin',
  });

  adminToken = signToken(adminUser._id, 'admin');

  // 3 available + 1 unavailable
  itemStarter1    = await MenuItem.create({ hotelId: hotel._id, name: 'Veg Spring Roll', category: 'Starters', price: 180, isVeg: true });
  itemStarter2    = await MenuItem.create({ hotelId: hotel._id, name: 'Chicken Tikka',   category: 'Starters', price: 320, isVeg: false });
  itemMain        = await MenuItem.create({ hotelId: hotel._id, name: 'Dal Makhani',     category: 'Mains',    price: 280, isVeg: true });
  itemUnavailable = await MenuItem.create({ hotelId: hotel._id, name: 'Fish Curry',      category: 'Mains',    price: 350, isVeg: false, available: false });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  try { fs.rmSync(TEST_UPLOADS, { recursive: true, force: true }); } catch {}
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('P03 - Menu', () => {

  test('GET /menu/:hotelId returns all items and excludes stats', async () => {
    const res = await request(app).get(`/api/menu/${hotel._id}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(4);
    // Public endpoint must not expose stats
    expect(res.body.items[0].stats).toBeUndefined();
  });

  test('GET /menu/:hotelId?category=Starters filters by category', async () => {
    const res = await request(app).get(`/api/menu/${hotel._id}?category=Starters`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.every(i => i.category === 'Starters')).toBe(true);
  });

  test('GET /menu/:hotelId?available=false returns only unavailable items', async () => {
    const res = await request(app).get(`/api/menu/${hotel._id}?available=false`);

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].name).toBe('Fish Curry');
    expect(res.body.items[0].available).toBe(false);
  });

  test('GET /menu/:hotelId/item/:itemId returns single item with stats field', async () => {
    const res = await request(app).get(`/api/menu/${hotel._id}/item/${itemMain._id}`);

    expect(res.status).toBe(200);
    expect(res.body.item.name).toBe('Dal Makhani');
    expect(res.body.item.stats).toBeDefined();
    expect(res.body.item.stats.totalOrders).toBeDefined();
  });

  test('GET /menu/:hotelId/item/:itemId returns 404 for unknown itemId', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app).get(`/api/menu/${hotel._id}/item/${fakeId}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toBeDefined();
  });

  test('GET /menu/admin/all returns all items including unavailable (admin auth required)', async () => {
    // Unauthenticated request must fail
    const unauth = await request(app).get('/api/menu/admin/all');
    expect(unauth.status).toBe(401);

    // Authenticated admin request returns all items
    const res = await request(app)
      .get('/api/menu/admin/all')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(4);
    const names = res.body.items.map(i => i.name);
    expect(names).toContain('Fish Curry'); // unavailable item must appear
  });

  test('POST /menu creates item (multer disk write)', async () => {
    const res = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('photo', FAKE_JPEG, 'test-dish.jpg')
      .field('name', 'Masala Papad')
      .field('category', 'Starters')
      .field('price', '60')
      .field('isVeg', 'true')
      .field('tags', 'crispy,quick');

    expect(res.status).toBe(201);
    expect(res.body.item.name).toBe('Masala Papad');
    expect(res.body.item.category).toBe('Starters');
    expect(res.body.item.price).toBe(60);
    expect(res.body.item.photoUrl).toMatch(/^http:\/\/test\.example\.com\/uploads\/menu\/.+\.jpg$/);
  });

  test('POST /menu parses customizationOptions correctly from JSON string', async () => {
    const opts = [
      { groupName: 'Spice Level', type: 'single', required: true, choices: ['Mild', 'Medium', 'Hot'] },
    ];

    const res = await request(app)
      .post('/api/menu')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('name', 'Paneer Tikka')
      .field('category', 'Starters')
      .field('price', '250')
      .field('customizationOptions', JSON.stringify(opts));

    expect(res.status).toBe(201);
    expect(res.body.item.customizationOptions).toHaveLength(1);
    expect(res.body.item.customizationOptions[0].groupName).toBe('Spice Level');
    expect(res.body.item.customizationOptions[0].choices).toEqual(['Mild', 'Medium', 'Hot']);
  });

  test('PATCH /menu/:itemId updates item price', async () => {
    const res = await request(app)
      .patch(`/api/menu/${itemMain._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 299 });

    expect(res.status).toBe(200);
    expect(res.body.item.price).toBe(299);
    expect(res.body.item.name).toBe('Dal Makhani'); // other fields unchanged
  });

  test('PATCH /menu/:itemId/availability toggles item to unavailable', async () => {
    const res = await request(app)
      .patch(`/api/menu/${itemStarter1._id}/availability`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ available: false });

    expect(res.status).toBe(200);
    expect(res.body.item.available).toBe(false);
    expect(res.body.item.name).toBe('Veg Spring Roll');

    // Restore for other tests
    await MenuItem.findByIdAndUpdate(itemStarter1._id, { available: true });
  });

});
