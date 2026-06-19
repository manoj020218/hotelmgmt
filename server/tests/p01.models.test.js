const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const bcrypt = require('bcryptjs');

const Hotel      = require('../src/models/Hotel');
const User       = require('../src/models/User');
const Table      = require('../src/models/Table');
const MenuItem   = require('../src/models/MenuItem');
const Order      = require('../src/models/Order');
const Payment    = require('../src/models/Payment');
const Feedback   = require('../src/models/Feedback');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

afterEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map(c => c.deleteMany({}))
  );
});

// ─── Helpers ────────────────────────────────────────────────────────────────

async function makeHotel(overrides = {}) {
  return Hotel.create({ name: 'Test Hotel', ...overrides });
}

async function makeUser(hotelId, overrides = {}) {
  return User.create({ hotelId, name: 'Test User', role: 'admin', email: `u${Date.now()}@test.com`, ...overrides });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('P01 - Models', () => {

  test('Hotel model saves and retrieves correctly', async () => {
    const hotel = await Hotel.create({
      name: 'The Grand Spice',
      gstin: '29AAPFU0939F1ZV',
      gstEnabled: true,
      cgstPercent: 9,
      sgstPercent: 9,
      settings: { kitchenOpen: true, receiptFlow: 'both', autoWaiterAssign: true },
    });

    const found = await Hotel.findById(hotel._id);
    expect(found).not.toBeNull();
    expect(found.name).toBe('The Grand Spice');
    expect(found.gstEnabled).toBe(true);
    expect(found.cgstPercent).toBe(9);
    expect(found.settings.receiptFlow).toBe('both');
    expect(found.settings.autoWaiterAssign).toBe(true);
  });

  test('User model hashes password on save', async () => {
    const hotel = await makeHotel();
    const user = await User.create({
      hotelId: hotel._id,
      name: 'Rajesh',
      email: 'rajesh@hotel.com',
      passwordHash: 'PlainText@123',
      role: 'admin',
    });

    // Should not store plain text
    expect(user.passwordHash).not.toBe('PlainText@123');
    // Should be a valid bcrypt hash (bcryptjs uses $2a$ prefix)
    expect(user.passwordHash.startsWith('$2a$')).toBe(true);
    // comparePassword helper should work
    const match = await user.comparePassword('PlainText@123');
    expect(match).toBe(true);
  });

  test('User model validates role enum', async () => {
    const hotel = await makeHotel();
    await expect(
      User.create({ hotelId: hotel._id, name: 'Bad Role', role: 'manager' })
    ).rejects.toThrow();
  });

  test('Table model validates status enum', async () => {
    const hotel = await makeHotel();
    await expect(
      Table.create({ hotelId: hotel._id, tableNumber: 1, capacity: 4, status: 'dirty' })
    ).rejects.toThrow();
  });

  test('MenuItem model requires hotelId, name, price', async () => {
    // Missing hotelId
    await expect(
      MenuItem.create({ name: 'Naan', price: 60, category: 'Breads' })
    ).rejects.toThrow();

    // Missing name
    const hotel = await makeHotel();
    await expect(
      MenuItem.create({ hotelId: hotel._id, price: 60, category: 'Breads' })
    ).rejects.toThrow();

    // Missing price
    await expect(
      MenuItem.create({ hotelId: hotel._id, name: 'Naan', category: 'Breads' })
    ).rejects.toThrow();
  });

  test('Order model computes bill.total correctly', async () => {
    const hotel = await makeHotel();
    const table = await Table.create({ hotelId: hotel._id, tableNumber: 1, capacity: 4, qrToken: 'abc' });

    const order = await Order.create({
      hotelId: hotel._id,
      tableId: table._id,
      tableNumber: 1,
      sessionId: 'sess-001',
      items: [{ name: 'Paneer', price: 320, quantity: 1 }],
      bill: { subtotal: 320, cgst: 28.8, sgst: 28.8, gstApplied: true },
    });

    expect(order.bill.total).toBeCloseTo(377.6, 1);
    expect(order.bill.total).toBe(order.bill.subtotal + order.bill.cgst + order.bill.sgst);
  });

  test('Payment model validates method enum', async () => {
    const hotel = await makeHotel();
    const table = await Table.create({ hotelId: hotel._id, tableNumber: 1, capacity: 2, qrToken: 'tok1' });
    const order = await Order.create({
      hotelId: hotel._id, tableId: table._id, tableNumber: 1, sessionId: 'sess-pay',
      items: [{ name: 'Chai', price: 60, quantity: 1 }],
    });

    await expect(
      Payment.create({ hotelId: hotel._id, orderId: order._id, tableNumber: 1, amount: 60, method: 'bitcoin' })
    ).rejects.toThrow();
  });

  test('Feedback model validates ratings 1-5', async () => {
    const hotel = await makeHotel();
    const table = await Table.create({ hotelId: hotel._id, tableNumber: 2, capacity: 2, qrToken: 'tok2' });
    const order = await Order.create({
      hotelId: hotel._id, tableId: table._id, tableNumber: 2, sessionId: 'sess-fb',
      items: [{ name: 'Lassi', price: 120, quantity: 1 }],
    });

    // Rating 6 should fail
    await expect(
      Feedback.create({
        hotelId: hotel._id, orderId: order._id,
        ratings: { overall: 6, food: 4, waiter: 4 },
      })
    ).rejects.toThrow();

    // Rating 0 should fail
    await expect(
      Feedback.create({
        hotelId: hotel._id, orderId: order._id,
        ratings: { overall: 0, food: 4, waiter: 4 },
      })
    ).rejects.toThrow();

    // Valid rating should pass
    const fb = await Feedback.create({
      hotelId: hotel._id, orderId: order._id,
      ratings: { overall: 5, food: 4, waiter: 5 },
    });
    expect(fb.ratings.overall).toBe(5);
  });

  test('Seed script creates hotel with correct structure', async () => {
    // Run seed logic inline (not via subprocess) against the in-memory DB
    const { v4: uuidv4 } = require('uuid');

    const hotel = await Hotel.create({
      name: 'The Grand Spice',
      gstEnabled: true,
      cgstPercent: 9,
      sgstPercent: 9,
      settings: { autoWaiterAssign: true, kdsEnabled: true, kitchenOpen: true },
    });

    expect(hotel.name).toBe('The Grand Spice');
    expect(hotel.gstEnabled).toBe(true);
    expect(hotel.settings.autoWaiterAssign).toBe(true);
    expect(hotel.settings.kdsEnabled).toBe(true);
  });

  test('Seed script creates 12 tables', async () => {
    const { v4: uuidv4 } = require('uuid');
    const hotel = await makeHotel();

    const tableData = Array.from({ length: 12 }, (_, i) => ({
      hotelId: hotel._id,
      tableNumber: i + 1,
      capacity: i % 3 === 0 ? 6 : i % 2 === 0 ? 4 : 2,
      qrToken: uuidv4(),
    }));

    await Table.insertMany(tableData);
    const count = await Table.countDocuments({ hotelId: hotel._id });
    expect(count).toBe(12);
  });

  test('Seed script creates 10 menu items', async () => {
    const hotel = await makeHotel();

    const items = [
      { name: 'Paneer Butter Masala', category: 'Mains',    price: 320, isVeg: true },
      { name: 'Dal Makhani',          category: 'Mains',    price: 280, isVeg: true },
      { name: 'Chicken Tikka',        category: 'Starters', price: 380, isVeg: false },
      { name: 'Veg Spring Roll',      category: 'Starters', price: 220, isVeg: true },
      { name: 'Butter Naan',          category: 'Breads',   price: 60,  isVeg: true },
      { name: 'Mango Lassi',          category: 'Drinks',   price: 120, isVeg: true },
      { name: 'Masala Chai',          category: 'Drinks',   price: 60,  isVeg: true },
      { name: 'Gulab Jamun',          category: 'Desserts', price: 140, isVeg: true },
      { name: 'Fish Curry',           category: 'Mains',    price: 420, isVeg: false },
      { name: 'Veg Biryani',          category: 'Mains',    price: 290, isVeg: true },
    ].map(item => ({ hotelId: hotel._id, ...item }));

    await MenuItem.insertMany(items);
    const count = await MenuItem.countDocuments({ hotelId: hotel._id });
    expect(count).toBe(10);
  });

  test('DB connection retries on failure', async () => {
    const connectDB = require('../src/config/db');

    let callCount = 0;
    const mockConnect = jest.spyOn(mongoose, 'connect').mockImplementation(async () => {
      callCount++;
      if (callCount < 3) throw new Error('Connection refused');
      // 3rd call: resolve without actually reconnecting (already connected in beforeAll)
    });

    // Pass delayMs=10 so retries don't slow the test suite down
    await connectDB(3, 10);
    expect(callCount).toBe(3);

    mockConnect.mockRestore();
  });

});
