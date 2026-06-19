const jwt     = require('jsonwebtoken');
const Payment = require('../models/Payment');
const Order   = require('../models/Order');
const Hotel   = require('../models/Hotel');
const { emitToHotel }   = require('../socket/socketHandler');
const { sendToTopic }   = require('../services/fcm.service');
const { generateReceipt } = require('../services/pdf.service');

// ── UPI deep link builder ─────────────────────────────────────────────────────
function buildUpiLinks(hotel, amount, tableNumber) {
  const pa  = encodeURIComponent(hotel.upiId  || '');
  const pn  = encodeURIComponent(hotel.name   || '');
  const am  = amount;
  const tn  = encodeURIComponent(`Table${tableNumber}`);

  return {
    gpay:     `gpay://upi/pay?pa=${pa}&pn=${pn}&am=${am}&tn=${tn}`,
    phonepay: `phonepe://pay?pa=${pa}&pn=${pn}&am=${am}`,
    generic:  `upi://pay?pa=${pa}&pn=${pn}&am=${am}`,
  };
}

// ── GET /api/payments/order/:orderId ─────────────────────────────────────────
async function getPaymentByOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Customer access: sessionId must match
    const authHeader = req.headers.authorization;
    let isAuth = false;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try { jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); isAuth = true; } catch {}
    }
    const sessionMatch = req.query.sessionId && req.query.sessionId === order.sessionId;
    if (!isAuth && !sessionMatch) return res.status(403).json({ error: 'Access denied' });

    const payment = order.paymentId
      ? await Payment.findById(order.paymentId)
      : null;

    const hotel      = await Hotel.findById(order.hotelId);
    const upiLinks   = hotel ? buildUpiLinks(hotel, order.bill.total, order.tableNumber) : {};

    res.json({ payment, bill: order.bill, upiDeepLinks: upiLinks });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/payments/:paymentId/mark-received ─────────────────────────────
async function markReceived(req, res, next) {
  try {
    const { method, upiRef } = req.body;
    const allowedMethods = ['cash', 'card', 'upi', 'gpay', 'phonepay'];
    if (!allowedMethods.includes(method)) {
      return res.status(400).json({ error: `Invalid payment method: ${method}` });
    }

    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    payment.status     = 'received';
    payment.method     = method;
    payment.receivedBy = req.user._id;
    payment.receivedAt = new Date();
    if (upiRef) payment.upiRef = upiRef;

    // Generate PDF receipt
    const order = await Order.findById(payment.orderId);
    const hotel = await Hotel.findById(payment.hotelId);

    let receiptUrl = '';
    if (order && hotel) {
      try {
        receiptUrl = await generateReceipt(order, hotel, payment);
        payment.receiptUrl = receiptUrl;
      } catch (pdfErr) {
        console.warn('[PDF] Receipt generation failed:', pdfErr.message);
      }
    }

    await payment.save();

    emitToHotel(payment.hotelId, 'payment:received', {
      paymentId:   payment._id,
      amount:      payment.amount,
      method,
      tableNumber: payment.tableNumber,
    });

    if (hotel && hotel.fcmTopics && hotel.fcmTopics.admin) {
      sendToTopic(hotel.fcmTopics.admin, {
        title: 'Payment Received',
        body:  `₹${payment.amount} via ${method} at Table ${payment.tableNumber}`,
      }, {}).catch(() => {});
    }

    res.json({ payment, receiptUrl });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/payments/:paymentId/receipt ─────────────────────────────────────
async function getReceipt(req, res, next) {
  try {
    const payment = await Payment.findById(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json({ receiptUrl: payment.receiptUrl });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/payments/:paymentId/dispute ─────────────────────────────────────
async function disputePayment(req, res, next) {
  try {
    const { reason } = req.body;
    const payment = await Payment.findByIdAndUpdate(
      req.params.paymentId,
      { status: 'disputed' },
      { new: true }
    );
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json({ payment, reason });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/payments/admin/today ─────────────────────────────────────────────
async function todayPayments(req, res, next) {
  try {
    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const payments = await Payment.find({
      hotelId:   req.user.hotelId,
      createdAt: { $gte: today, $lt: tomorrow },
    }).sort({ createdAt: -1 });

    const received = payments.filter(p => p.status === 'received');
    const totalCollected = received.reduce((sum, p) => sum + p.amount, 0);

    const byMethod = { cash: 0, upi: 0, gpay: 0, phonepay: 0, card: 0 };
    received.forEach(p => {
      if (byMethod[p.method] !== undefined) byMethod[p.method] += p.amount;
    });

    const pending = payments.filter(p => p.status === 'pending');

    res.json({ payments, totalCollected, byMethod, pending });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPaymentByOrder, markReceived, getReceipt, disputePayment, todayPayments };
