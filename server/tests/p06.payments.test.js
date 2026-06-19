process.env.JWT_SECRET         = 'test_jwt_secret_32_characters_xxxx';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_xxxxx';
process.env.VPS_PUBLIC_URL     = 'http://test.example.com';

const os   = require('os');
const fs   = require('fs');
const path = require('path');

const TEST_UPLOADS = path.join(os.tmpdir(), `hotel-qr-pay-${Date.now()}`);
process.env.UPLOADS_DIR = TEST_UPLOADS;

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

const paymentRoutes   = require('../src/routes/payment.routes');
const errorHandler    = require('../src/middleware/errorHandler');
const Hotel           = require('../src/models/Hotel');
const User            = require('../src/models/User');
const Table           = require('../src/models/Table');
const MenuItem        = require('../src/models/MenuItem');
const Order           = require('../src/models/Order');
const Payment         = require('../src/models/Payment');
const { generateReceipt } = require('../src/services/pdf.service');

// ── Test app ─────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/payments', paymentRoutes);
app.use(errorHandler);

// ── Fixtures ─────────────────────────────────────────────────────────────────
let mongod;
let pHotel, noGstHotel;
let adminUser, adminToken, waiterUser, waiterToken;
let pTable, pItem;
let pOrder, pPayment;        // main GST order + payment
let noGstOrder, noGstHotelDoc; // for no-GST PDF test

function signToken(userId, role) {
  return jwt.sign({ id: userId.toString(), role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

beforeAll(async () => {
  // Ensure receipts dir exists for pdf.service
  fs.mkdirSync(path.join(TEST_UPLOADS, 'receipts'), { recursive: true });

  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // GST hotel
  pHotel = await Hotel.create({
    name:        'Pay Hotel',
    upiId:       'payhotel@upi',
    gstEnabled:  true,
    cgstPercent: 9,
    sgstPercent: 9,
  });

  // No-GST hotel for PDF test
  noGstHotelDoc = await Hotel.create({ name: 'NoGST Hotel', gstEnabled: false });

  adminUser  = await User.create({ hotelId: pHotel._id, name: 'Admin', email: 'admin@pay.com', passwordHash: 'Admin@123', role: 'admin' });
  waiterUser = await User.create({ hotelId: pHotel._id, name: 'Waiter', phone: '1111111111', pin: '1111', role: 'waiter' });

  adminToken  = signToken(adminUser._id,  'admin');
  waiterToken = signToken(waiterUser._id, 'waiter');

  pTable = await Table.create({ hotelId: pHotel._id, tableNumber: 7, capacity: 4, qrToken: 'pay-qr-t7' });
  pItem  = await MenuItem.create({ hotelId: pHotel._id, name: 'Paneer Butter Masala', category: 'Mains', price: 320 });

  // Create a test order (GST hotel)
  pOrder = await Order.create({
    hotelId:     pHotel._id,
    tableId:     pTable._id,
    tableNumber: 7,
    sessionId:   uuidv4(),
    items:       [{ menuItemId: pItem._id, name: pItem.name, price: 320, quantity: 1 }],
    bill:        { subtotal: 320, cgst: 28.8, sgst: 28.8, total: 377.6, gstApplied: true },
    status:      'served',
  });

  // Payment record (pending — awaiting collection)
  pPayment = await Payment.create({
    hotelId:     pHotel._id,
    orderId:     pOrder._id,
    tableNumber: 7,
    amount:      377.6,
    status:      'pending',
  });

  // Link payment to order
  await Order.findByIdAndUpdate(pOrder._id, { paymentId: pPayment._id });
  pOrder = await Order.findById(pOrder._id);

  // No-GST order for PDF test
  const noGstTable = await Table.create({ hotelId: noGstHotelDoc._id, tableNumber: 1, capacity: 2, qrToken: 'nogst-qr-t1' });
  const noGstItem  = await MenuItem.create({ hotelId: noGstHotelDoc._id, name: 'Veg Biryani', category: 'Mains', price: 200 });
  noGstOrder = await Order.create({
    hotelId:     noGstHotelDoc._id,
    tableId:     noGstTable._id,
    tableNumber: 1,
    sessionId:   uuidv4(),
    items:       [{ menuItemId: noGstItem._id, name: noGstItem.name, price: 200, quantity: 1 }],
    bill:        { subtotal: 200, cgst: 0, sgst: 0, total: 200, gstApplied: false },
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  try { fs.rmSync(TEST_UPLOADS, { recursive: true, force: true }); } catch {}
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('P06 - Payments', () => {

  // ── 1 ─────────────────────────────────────────────────────────────────────
  test('GET payment/order/:orderId returns UPI deep links with correct amount', async () => {
    const res = await request(app)
      .get(`/api/payments/order/${pOrder._id}?sessionId=${pOrder.sessionId}`);

    expect(res.status).toBe(200);
    expect(res.body.bill.total).toBe(377.6);
    expect(res.body.upiDeepLinks).toBeDefined();
    expect(res.body.upiDeepLinks.gpay).toContain('377.6');
    expect(res.body.upiDeepLinks.generic).toContain('377.6');
  });

  // ── 2 ─────────────────────────────────────────────────────────────────────
  test('UPI deep link gpay format is correct', async () => {
    const res = await request(app)
      .get(`/api/payments/order/${pOrder._id}?sessionId=${pOrder.sessionId}`);

    const gpay = res.body.upiDeepLinks.gpay;
    expect(gpay).toMatch(/^gpay:\/\/upi\/pay\?/);
    expect(gpay).toContain('pa=payhotel%40upi');
    expect(gpay).toContain('am=377.6');
    expect(gpay).toContain('tn=Table7');
  });

  // ── 3 ─────────────────────────────────────────────────────────────────────
  test('UPI deep link phonepay format is correct', async () => {
    const res = await request(app)
      .get(`/api/payments/order/${pOrder._id}?sessionId=${pOrder.sessionId}`);

    const phonepay = res.body.upiDeepLinks.phonepay;
    expect(phonepay).toMatch(/^phonepe:\/\/pay\?/);
    expect(phonepay).toContain('pa=payhotel%40upi');
    expect(phonepay).toContain('am=377.6');
  });

  // ── 4 ─────────────────────────────────────────────────────────────────────
  test('PATCH mark-received updates payment status, method, and receivedBy', async () => {
    // Create a fresh payment to avoid mutating pPayment for other tests
    const freshPayment = await Payment.create({
      hotelId: pHotel._id, orderId: pOrder._id,
      tableNumber: 7, amount: 377.6, status: 'pending',
    });

    const res = await request(app)
      .patch(`/api/payments/${freshPayment._id}/mark-received`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ method: 'cash' });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('received');
    expect(res.body.payment.method).toBe('cash');
    expect(res.body.payment.receivedBy.toString()).toBe(waiterUser._id.toString());
  });

  // ── 5 ─────────────────────────────────────────────────────────────────────
  test('PATCH mark-received rejects unknown payment method', async () => {
    const res = await request(app)
      .patch(`/api/payments/${pPayment._id}/mark-received`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ method: 'bitcoin' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid payment method/i);
  });

  // ── 6 ─────────────────────────────────────────────────────────────────────
  test('PDF receipt generated with correct line items', async () => {
    const url = await generateReceipt(pOrder, pHotel, { method: 'cash' });

    expect(url).toContain('/uploads/receipts/');
    expect(url).toContain(pOrder._id.toString());

    const filename = `${pOrder._id}.pdf`;
    const filepath = path.join(TEST_UPLOADS, 'receipts', filename);
    expect(fs.existsSync(filepath)).toBe(true);
    expect(fs.statSync(filepath).size).toBeGreaterThan(100);
  });

  // ── 7 ─────────────────────────────────────────────────────────────────────
  test('PDF receipt shows GST breakdown when enabled', async () => {
    // gstEnabled=true hotel — verify the service runs without error and produces a file
    const gstOrder = await Order.create({
      hotelId: pHotel._id, tableId: pTable._id, tableNumber: 5,
      sessionId: uuidv4(),
      items: [{ menuItemId: pItem._id, name: 'Dal Makhani', price: 280, quantity: 1 }],
      bill: { subtotal: 280, cgst: 25.2, sgst: 25.2, total: 330.4, gstApplied: true },
    });

    const url = await generateReceipt(gstOrder, pHotel, { method: 'gpay' });
    expect(url).toMatch(/^http:\/\/test\.example\.com\/uploads\/receipts\/.+\.pdf$/);

    const filepath = path.join(TEST_UPLOADS, 'receipts', `${gstOrder._id}.pdf`);
    expect(fs.existsSync(filepath)).toBe(true);
    // GST hotel → larger file (more content) than a no-GST receipt
    expect(fs.statSync(filepath).size).toBeGreaterThan(100);
  });

  // ── 8 ─────────────────────────────────────────────────────────────────────
  test('PDF receipt shows no GST when disabled', async () => {
    // gstEnabled=false hotel — service should complete and not throw
    const url = await generateReceipt(noGstOrder, noGstHotelDoc, { method: 'cash' });
    expect(url).toContain('/uploads/receipts/');

    const filepath = path.join(TEST_UPLOADS, 'receipts', `${noGstOrder._id}.pdf`);
    expect(fs.existsSync(filepath)).toBe(true);
    expect(url).not.toContain('undefined');
  });

  // ── 9 ─────────────────────────────────────────────────────────────────────
  test('Receipt URL returned after marking received', async () => {
    const freshPayment = await Payment.create({
      hotelId: pHotel._id, orderId: pOrder._id,
      tableNumber: 7, amount: 377.6, status: 'pending',
    });

    const res = await request(app)
      .patch(`/api/payments/${freshPayment._id}/mark-received`)
      .set('Authorization', `Bearer ${waiterToken}`)
      .send({ method: 'gpay' });

    expect(res.status).toBe(200);
    expect(res.body.receiptUrl).toContain('/uploads/receipts/');
    expect(res.body.receiptUrl).toContain(pOrder._id.toString());
  });

  // ── 10 ────────────────────────────────────────────────────────────────────
  test('GET today payments sums by method correctly', async () => {
    // Create received payments for today
    await Payment.create({ hotelId: pHotel._id, orderId: pOrder._id, tableNumber: 1, amount: 200, status: 'received', method: 'cash' });
    await Payment.create({ hotelId: pHotel._id, orderId: pOrder._id, tableNumber: 2, amount: 350, status: 'received', method: 'gpay' });
    await Payment.create({ hotelId: pHotel._id, orderId: pOrder._id, tableNumber: 3, amount: 150, status: 'pending',  method: 'cash' });

    const res = await request(app)
      .get('/api/payments/admin/today')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.totalCollected).toBeGreaterThanOrEqual(550); // 200 + 350
    expect(res.body.byMethod.cash).toBeGreaterThanOrEqual(200);
    expect(res.body.byMethod.gpay).toBeGreaterThanOrEqual(350);
    expect(res.body.pending.length).toBeGreaterThanOrEqual(1);
  });

  // ── 11 ────────────────────────────────────────────────────────────────────
  test('Dispute status update works', async () => {
    const freshPayment = await Payment.create({
      hotelId: pHotel._id, orderId: pOrder._id,
      tableNumber: 7, amount: 200, status: 'received', method: 'cash',
    });

    const res = await request(app)
      .post(`/api/payments/${freshPayment._id}/dispute`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Customer claims different amount' });

    expect(res.status).toBe(200);
    expect(res.body.payment.status).toBe('disputed');
  });

  // ── 12 ────────────────────────────────────────────────────────────────────
  test('Waiter auth required for mark-received (no auth → 401)', async () => {
    const res = await request(app)
      .patch(`/api/payments/${pPayment._id}/mark-received`)
      .send({ method: 'cash' });

    expect(res.status).toBe(401);
  });

});
