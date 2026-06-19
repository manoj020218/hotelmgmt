const Hotel           = require('../models/Hotel');
const { emitToHotel } = require('../socket/socketHandler');
const { getPublicUrl } = require('../config/storage');

// ── GET /api/settings ─────────────────────────────────────────────────────────
async function getSettings(req, res, next) {
  try {
    const hotel = await Hotel.findById(req.user.hotelId);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json({ hotel });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/settings/hotel ─────────────────────────────────────────────────
async function updateHotel(req, res, next) {
  try {
    const { name, address, phone, gstin } = req.body;

    if (phone !== undefined && phone !== '' && !/^\+?[\d\s\-().]{7,20}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone format' });
    }

    const updates = {};
    if (name    !== undefined) updates.name    = name;
    if (address !== undefined) updates.address = address;
    if (phone   !== undefined) updates.phone   = phone;
    if (gstin   !== undefined) updates.gstin   = gstin;

    const hotel = await Hotel.findByIdAndUpdate(req.user.hotelId, updates, { new: true, runValidators: true });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json({ hotel });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    next(err);
  }
}

// ── PATCH /api/settings/gst ───────────────────────────────────────────────────
async function updateGst(req, res, next) {
  try {
    const { gstEnabled, cgstPercent, sgstPercent, gstin } = req.body;

    if (cgstPercent !== undefined && (cgstPercent < 0 || cgstPercent > 50)) {
      return res.status(400).json({ error: 'cgstPercent must be between 0 and 50' });
    }
    if (sgstPercent !== undefined && (sgstPercent < 0 || sgstPercent > 50)) {
      return res.status(400).json({ error: 'sgstPercent must be between 0 and 50' });
    }

    const updates = {};
    if (gstEnabled  !== undefined) updates.gstEnabled  = gstEnabled;
    if (cgstPercent !== undefined) updates.cgstPercent = cgstPercent;
    if (sgstPercent !== undefined) updates.sgstPercent = sgstPercent;
    if (gstin       !== undefined) updates.gstin       = gstin;

    const hotel = await Hotel.findByIdAndUpdate(req.user.hotelId, updates, { new: true, runValidators: true });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json({ hotel });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    next(err);
  }
}

// ── PATCH /api/settings/operations ───────────────────────────────────────────
async function updateOperations(req, res, next) {
  try {
    const { kdsEnabled, tableVisibilityPublic, autoWaiterAssign, orderModificationWindow } = req.body;

    const hotel = await Hotel.findById(req.user.hotelId);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    const prevKds = hotel.settings.kdsEnabled;

    if (kdsEnabled              !== undefined) hotel.settings.kdsEnabled              = kdsEnabled;
    if (tableVisibilityPublic   !== undefined) hotel.settings.tableVisibilityPublic   = tableVisibilityPublic;
    if (autoWaiterAssign        !== undefined) hotel.settings.autoWaiterAssign        = autoWaiterAssign;
    if (orderModificationWindow !== undefined) hotel.settings.orderModificationWindow = orderModificationWindow;

    await hotel.save();

    if (kdsEnabled !== undefined && kdsEnabled !== prevKds) {
      emitToHotel(hotel._id, 'settings:kds', { kdsEnabled });
    }

    res.json({ hotel });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/settings/kitchen ───────────────────────────────────────────────
async function updateKitchen(req, res, next) {
  try {
    const { kitchenOpen, kitchenOpenTime, kitchenCloseTime } = req.body;

    const hotel = await Hotel.findById(req.user.hotelId);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    if (kitchenOpen      !== undefined) hotel.settings.kitchenOpen      = kitchenOpen;
    if (kitchenOpenTime  !== undefined) hotel.settings.kitchenOpenTime  = kitchenOpenTime;
    if (kitchenCloseTime !== undefined) hotel.settings.kitchenCloseTime = kitchenCloseTime;

    await hotel.save();

    if (kitchenOpen !== undefined) {
      emitToHotel(hotel._id, kitchenOpen ? 'kitchen:open' : 'kitchen:closed', { kitchenOpen });
    }

    res.json({ hotel });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/settings/payment ───────────────────────────────────────────────
async function updatePayment(req, res, next) {
  try {
    const { upiId, receiptFlow } = req.body;

    const updates = {};
    if (upiId       !== undefined) updates.upiId                  = upiId;
    if (receiptFlow !== undefined) updates['settings.receiptFlow'] = receiptFlow;

    const hotel = await Hotel.findByIdAndUpdate(req.user.hotelId, updates, { new: true, runValidators: true });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });
    res.json({ hotel });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    next(err);
  }
}

// ── POST /api/settings/upi-qr ────────────────────────────────────────────────
async function uploadUpiQr(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const upiQrUrl = getPublicUrl('upi', req.file.filename);
    const hotel    = await Hotel.findByIdAndUpdate(req.user.hotelId, { upiQrUrl }, { new: true });
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    res.json({ upiQrUrl, hotel });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSettings, updateHotel, updateGst, updateOperations, updateKitchen, updatePayment, uploadUpiQr };
