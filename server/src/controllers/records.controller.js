const crypto     = require('crypto');
const Order      = require('../models/Order');
const Payment    = require('../models/Payment');
const DeleteCode = require('../models/DeleteCode');

// ── Helper: validate and consume a delete code ────────────────────────────────
async function consumeCode(hotelId, code) {
  const record = await DeleteCode.findOne({
    hotelId,
    code,
    usedAt:    null,
    expiresAt: { $gt: new Date() },
  });
  if (!record) return false;
  record.usedAt = new Date();
  await record.save();
  return true;
}

// ── POST /api/records/generate-delete-code ────────────────────────────────────
// Called by external Super Admin system (iotsoft.in/clients)
// Authenticated by shared secret in header: x-superadmin-secret
async function generateDeleteCode(req, res, next) {
  try {
    const secret = process.env.SUPERADMIN_SECRET;
    if (!secret || req.headers['x-superadmin-secret'] !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { hotelId, expiresInSeconds = 300 } = req.body;
    if (!hotelId) return res.status(400).json({ error: 'hotelId is required' });

    const code      = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit
    const expiresAt = new Date(Date.now() + Math.min(expiresInSeconds, 3600) * 1000);

    await DeleteCode.create({ hotelId, code, expiresAt });

    res.json({ code, expiresAt });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/records/orders ───────────────────────────────────────────────────
// Admin: fetch orders grouped by day (IST), paginated by day
async function getOrderRecords(req, res, next) {
  try {
    const { from, to } = req.query;

    const match = { hotelId: req.user.hotelId };
    if (from || to) {
      match.createdAt = {};
      if (from) match.createdAt.$gte = new Date(from);
      if (to)   match.createdAt.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }

    const orders = await Order.find(match)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // Group by IST date
    const IST_OFFSET = 5.5 * 60 * 60 * 1000;
    const groups = {};
    for (const o of orders) {
      const ist = new Date(o.createdAt.getTime() + IST_OFFSET);
      const day = ist.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!groups[day]) groups[day] = [];
      groups[day].push(o);
    }

    const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    res.json({ days: days.map(d => ({ date: d, orders: groups[d] })) });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/records/all?code=XXXXXX ──────────────────────────────────────
async function deleteAllRecords(req, res, next) {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Confirmation code is required' });

    const valid = await consumeCode(req.user.hotelId.toString(), code);
    if (!valid) return res.status(403).json({ error: 'Invalid or expired confirmation code' });

    const [orders, payments] = await Promise.all([
      Order.deleteMany({ hotelId: req.user.hotelId }),
      Payment.deleteMany({ hotelId: req.user.hotelId }),
    ]);

    res.json({ deleted: { orders: orders.deletedCount, payments: payments.deletedCount } });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/records/before-date?date=YYYY-MM-DD&code=XXXXXX ──────────────
async function deleteBeforeDate(req, res, next) {
  try {
    const { date, code } = req.query;
    if (!date) return res.status(400).json({ error: 'date is required (YYYY-MM-DD)' });
    if (!code) return res.status(400).json({ error: 'Confirmation code is required' });

    const valid = await consumeCode(req.user.hotelId.toString(), code);
    if (!valid) return res.status(403).json({ error: 'Invalid or expired confirmation code' });

    const before = new Date(date);
    before.setHours(23, 59, 59, 999);

    const [orders, payments] = await Promise.all([
      Order.deleteMany({ hotelId: req.user.hotelId, createdAt: { $lte: before } }),
      Payment.deleteMany({ hotelId: req.user.hotelId, createdAt: { $lte: before } }),
    ]);

    res.json({ deleted: { orders: orders.deletedCount, payments: payments.deletedCount } });
  } catch (err) {
    next(err);
  }
}

module.exports = { generateDeleteCode, getOrderRecords, deleteAllRecords, deleteBeforeDate };
