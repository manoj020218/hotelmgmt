const User  = require('../models/User');
const Order = require('../models/Order');
const { emitToHotel } = require('../socket/socketHandler');

// ── GET /api/waiters ──────────────────────────────────────────────────────────
async function getAllWaiters(req, res, next) {
  try {
    const waiters = await User.find({
      hotelId: req.user.hotelId,
      role:    { $in: ['waiter', 'kitchen'] },
    })
      .select('-passwordHash -pin -refreshToken')
      .sort({ name: 1 });

    res.json({ waiters });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/waiters ─────────────────────────────────────────────────────────
async function createWaiter(req, res, next) {
  try {
    const { name, phone, pin, role } = req.body;
    if (!name || !pin || !role) {
      return res.status(400).json({ error: 'name, pin, and role are required' });
    }
    if (!['waiter', 'kitchen'].includes(role)) {
      return res.status(400).json({ error: 'role must be waiter or kitchen' });
    }

    const user = await User.create({
      hotelId: req.user.hotelId,
      name,
      phone:  phone || '',
      pin,
      role,
    });

    // Return without sensitive fields
    const safe = await User.findById(user._id).select('-passwordHash -pin -refreshToken');
    res.status(201).json({ user: safe });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/waiters/:waiterId ──────────────────────────────────────────────
async function updateWaiter(req, res, next) {
  try {
    const allowed = ['name', 'phone', 'available', 'isActive'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.waiterId, hotelId: req.user.hotelId },
      updates,
      { new: true }
    ).select('-passwordHash -pin -refreshToken');
    if (!user) return res.status(404).json({ error: 'Waiter not found' });

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/waiters/:waiterId/availability ─────────────────────────────────
async function toggleAvailability(req, res, next) {
  try {
    const { available } = req.body;
    if (available === undefined) return res.status(400).json({ error: 'available field required' });

    const user = await User.findOneAndUpdate(
      { _id: req.params.waiterId, hotelId: req.user.hotelId },
      { available, manuallyOffline: !available },
      { new: true }
    ).select('-passwordHash -pin -refreshToken');
    if (!user) return res.status(404).json({ error: 'Waiter not found' });

    emitToHotel(user.hotelId, 'waiter:availability', {
      waiterId:  user._id,
      available,
      name:      user.name,
    });

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/waiters/:waiterId ─────────────────────────────────────────────
async function deleteWaiter(req, res, next) {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.waiterId,
      { isActive: false },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'Waiter not found' });

    res.json({ message: 'Waiter deactivated' });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/waiters/:waiterId/orders ─────────────────────────────────────────
async function getWaiterOrders(req, res, next) {
  try {
    const orders = await Order.find({ assignedWaiterId: req.params.waiterId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAllWaiters, createWaiter, updateWaiter, toggleAvailability, deleteWaiter, getWaiterOrders };
