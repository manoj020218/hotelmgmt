const qrcode = require('qrcode');
const path   = require('path');
const fs     = require('fs');
const { v4: uuidv4 } = require('uuid');

const Table  = require('../models/Table');
const Hotel  = require('../models/Hotel');
const Order  = require('../models/Order');
const { emitToHotel } = require('../socket/socketHandler');

// ── QR generator helper ───────────────────────────────────────────────────────
async function generateTableQR(hotelId, tableId, qrToken) {
  const frontendUrl = (process.env.FRONTEND_URL || process.env.VPS_PUBLIC_URL || 'http://localhost:5173').replace(/\/$/, '');
  const qrContent   = `${frontendUrl}/menu?hotel=${hotelId}&table=${qrToken}`;

  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
  const qrDir      = path.join(uploadsDir, 'qr');
  if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir, { recursive: true });

  const filename = `${hotelId}_${tableId}.png`;
  const filePath = path.join(qrDir, filename);

  await qrcode.toFile(filePath, qrContent, { type: 'png', width: 400, margin: 2 });

  const base = (process.env.VPS_PUBLIC_URL || 'http://localhost:5000').replace(/\/$/, '');
  return { qrCodeUrl: `${base}/uploads/qr/${filename}`, qrContent };
}

// ── GET /api/tables/:hotelId/public ──────────────────────────────────────────
async function getPublicTables(req, res, next) {
  try {
    const hotel = await Hotel.findById(req.params.hotelId);
    if (!hotel || !hotel.settings.tableVisibilityPublic) {
      return res.status(403).json({ error: 'Table visibility is disabled for this hotel' });
    }

    const tables = await Table.find({ hotelId: req.params.hotelId })
      .select('tableNumber capacity status')
      .sort({ tableNumber: 1 });

    res.json({ tables });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/tables ────────────────────────────────────────────────────────────
async function getAllTables(req, res, next) {
  try {
    const tables = await Table.find({ hotelId: req.user.hotelId })
      .populate('currentOrderId', 'status bill')
      .populate('assignedWaiterId', 'name')
      .sort({ tableNumber: 1 });

    res.json({ tables });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/tables ────────────────────────────────────────────────────────────
async function createTable(req, res, next) {
  try {
    const { tableNumber, capacity } = req.body;
    if (!tableNumber || !capacity) {
      return res.status(400).json({ error: 'tableNumber and capacity are required' });
    }

    const qrToken = uuidv4();

    const table = await Table.create({
      hotelId: req.user.hotelId,
      tableNumber,
      capacity,
      qrToken,
    });

    // Generate QR code (fire and forget in production; awaited here for immediate URL)
    try {
      const { qrCodeUrl } = await generateTableQR(req.user.hotelId, table._id, qrToken);
      table.qrCodeUrl = qrCodeUrl;
      await table.save();
    } catch (qrErr) {
      console.warn('[QR] Generation failed:', qrErr.message);
    }

    res.status(201).json({ table });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/tables/:tableId/status ─────────────────────────────────────────
async function updateTableStatus(req, res, next) {
  try {
    const { status, reservedFor } = req.body;
    const update = { status };
    if (status === 'reserved' && reservedFor) {
      update.reservedFor = reservedFor;
      update.reservedAt  = new Date();
    } else {
      update.reservedFor = '';
    }

    const table = await Table.findOneAndUpdate(
      { _id: req.params.tableId, hotelId: req.user.hotelId },
      update,
      { new: true }
    );
    if (!table) return res.status(404).json({ error: 'Table not found' });

    emitToHotel(table.hotelId, 'table:status', {
      tableId:     table._id,
      tableNumber: table.tableNumber,
      status,
    });

    res.json({ table });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/tables/:tableId/notes ──────────────────────────────────────────
async function addNote(req, res, next) {
  try {
    const { text, tag } = req.body;
    if (!text) return res.status(400).json({ error: 'Note text is required' });

    const table = await Table.findOneAndUpdate(
      { _id: req.params.tableId, hotelId: req.user.hotelId },
      { $push: { notes: { text, tag: tag || '', addedBy: req.user._id, addedAt: new Date() } } },
      { new: true }
    );
    if (!table) return res.status(404).json({ error: 'Table not found' });

    res.json({ table });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/tables/:tableId/notes/:noteIndex ──────────────────────────────
async function deleteNote(req, res, next) {
  try {
    const table = await Table.findOne({ _id: req.params.tableId, hotelId: req.user.hotelId });
    if (!table) return res.status(404).json({ error: 'Table not found' });

    const idx = parseInt(req.params.noteIndex, 10);
    if (isNaN(idx) || idx < 0 || idx >= table.notes.length) {
      return res.status(400).json({ error: 'Invalid note index' });
    }

    table.notes.splice(idx, 1);
    await table.save();

    res.json({ table });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/tables/:tableId/qr ───────────────────────────────────────────────
async function getTableQR(req, res, next) {
  try {
    const table = await Table.findOne({ _id: req.params.tableId, hotelId: req.user.hotelId }).select('qrToken qrCodeUrl tableNumber hotelId');
    if (!table) return res.status(404).json({ error: 'Table not found' });

    res.json({ qrCodeUrl: table.qrCodeUrl, qrToken: table.qrToken });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/tables/:tableId/assign-waiter ─────────────────────────────────
async function assignWaiterToTable(req, res, next) {
  try {
    const { waiterId } = req.body;

    const table = await Table.findOneAndUpdate(
      { _id: req.params.tableId, hotelId: req.user.hotelId },
      { assignedWaiterId: waiterId || null },
      { new: true }
    ).populate('assignedWaiterId', 'name');

    if (!table) return res.status(404).json({ error: 'Table not found' });

    res.json({ table });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/tables/:tableId/session ─────────────────────────────────────────
async function getTableSession(req, res, next) {
  try {
    const table = await Table.findOne({ _id: req.params.tableId, hotelId: req.user.hotelId });
    if (!table) return res.status(404).json({ error: 'Table not found' });

    if (!table.sessionStartedAt) return res.json({ orders: [], sessionBillTotal: 0 });

    const orders = await Order.find({
      tableId:   table._id,
      createdAt: { $gte: table.sessionStartedAt },
    }).sort({ createdAt: 1 });

    res.json({ orders, sessionBillTotal: table.sessionBillTotal ?? 0 });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/tables/:tableId/checkout ────────────────────────────────────────
async function checkoutTable(req, res, next) {
  try {
    const table = await Table.findOneAndUpdate(
      { _id: req.params.tableId, hotelId: req.user.hotelId },
      {
        status:           'available',
        currentOrderId:   null,
        sessionStartedAt: null,
        sessionBillTotal: 0,
        hasNewOrder:      false,
      },
      { new: true }
    );
    if (!table) return res.status(404).json({ error: 'Table not found' });

    emitToHotel(table.hotelId, 'table:status', {
      tableId:          table._id,
      tableNumber:      table.tableNumber,
      status:           'available',
      hasNewOrder:      false,
      sessionBillTotal: 0,
    });

    res.json({ table });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/tables/:tableId/history ─────────────────────────────────────────
async function getTableHistory(req, res, next) {
  try {
    const hotel = await Hotel.findById(req.user.hotelId);
    const days  = Math.min(hotel?.settings?.orderHistoryDays ?? 1, 7);

    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const orders = await Order.find({
      tableId:   req.params.tableId,
      hotelId:   req.user.hotelId,
      createdAt: { $gte: since },
    }).sort({ createdAt: -1 });

    res.json({ orders, days });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPublicTables, getAllTables, createTable,
  updateTableStatus, addNote, deleteNote, getTableQR, assignWaiterToTable,
  getTableSession, checkoutTable, getTableHistory,
};
