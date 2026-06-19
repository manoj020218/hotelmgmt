const jwt = require('jsonwebtoken');
const User = require('../models/User');

function signAccess(userId, role, hotelId) {
  return jwt.sign(
    { id: userId, role, hotelId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

function signRefresh(userId) {
  return jwt.sign(
    { id: userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

// POST /api/auth/admin/login
async function adminLogin(req, res, next) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const user = await User.findOne({ email: email.toLowerCase(), role: 'admin', isActive: true });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken = signAccess(user._id, user.role, user.hotelId);
    const refreshToken = signRefresh(user._id);

    user.refreshToken = refreshToken;
    user.lastSeen = new Date();
    await user.save();

    return res.json({
      accessToken,
      refreshToken,
      user: { id: user._id, name: user.name, role: user.role, hotelId: user.hotelId },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/waiter/login
async function waiterLogin(req, res, next) {
  try {
    const { pin, hotelId } = req.body;
    if (!pin || !hotelId) return res.status(400).json({ error: 'pin and hotelId required' });

    const waiters = await User.find({ hotelId, role: 'waiter', isActive: true });
    let matched = null;
    for (const w of waiters) {
      if (w.pin && await w.comparePin(pin)) { matched = w; break; }
    }
    if (!matched) return res.status(401).json({ error: 'Invalid PIN' });

    const accessToken = signAccess(matched._id, matched.role, matched.hotelId);
    const refreshToken = signRefresh(matched._id);

    matched.refreshToken = refreshToken;
    matched.lastSeen = new Date();
    await matched.save();

    return res.json({
      accessToken,
      refreshToken,
      user: { id: matched._id, name: matched.name, role: matched.role, hotelId: matched.hotelId },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/kitchen/login
async function kitchenLogin(req, res, next) {
  try {
    const { pin, hotelId } = req.body;
    if (!pin || !hotelId) return res.status(400).json({ error: 'pin and hotelId required' });

    const stations = await User.find({ hotelId, role: 'kitchen', isActive: true });
    let matched = null;
    for (const s of stations) {
      if (s.pin && await s.comparePin(pin)) { matched = s; break; }
    }
    if (!matched) return res.status(401).json({ error: 'Invalid PIN' });

    const accessToken = signAccess(matched._id, matched.role, matched.hotelId);

    matched.lastSeen = new Date();
    await matched.save();

    return res.json({
      accessToken,
      user: { id: matched._id, name: matched.name, role: matched.role, hotelId: matched.hotelId },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/refresh
async function refresh(req, res, next) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' });

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const user = await User.findById(decoded.id);
    if (!user || !user.isActive || user.refreshToken !== refreshToken) {
      return res.status(401).json({ error: 'Refresh token revoked' });
    }

    const accessToken = signAccess(user._id, user.role, user.hotelId);
    return res.json({ accessToken });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
async function logout(req, res, next) {
  try {
    await User.findByIdAndUpdate(req.user._id, { refreshToken: '' });
    return res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
function me(req, res) {
  return res.json({ user: req.user });
}

// POST /api/auth/fcm-token
async function saveFcmToken(req, res, next) {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) return res.status(400).json({ error: 'fcmToken required' });
    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    return res.json({ message: 'FCM token saved' });
  } catch (err) {
    next(err);
  }
}

module.exports = { adminLogin, waiterLogin, kitchenLogin, refresh, logout, me, saveFcmToken };
