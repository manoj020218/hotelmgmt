const User = require('../models/User');

const BUSY_THRESHOLD = 3;

async function assignWaiter(hotelId, orderId) {
  const waiters = await User.find({ hotelId, role: 'waiter', available: true, isActive: true });

  if (waiters.length === 0) {
    return { waiter: null, adminQueue: true };
  }

  waiters.sort((a, b) => {
    const diff = a.activeOrderIds.length - b.activeOrderIds.length;
    return diff !== 0 ? diff : b.stats.avgRating - a.stats.avgRating;
  });

  const waiter = waiters[0];
  waiter.activeOrderIds.push(orderId);
  if (waiter.activeOrderIds.length >= BUSY_THRESHOLD) {
    waiter.available = false;
  }
  await waiter.save();

  return { waiter, adminQueue: false };
}

async function releaseOrder(waiterId, orderId) {
  if (!waiterId) return null;

  const waiter = await User.findById(waiterId);
  if (!waiter) return null;

  waiter.activeOrderIds = waiter.activeOrderIds.filter(id => !id.equals(orderId));
  if (waiter.activeOrderIds.length < BUSY_THRESHOLD) {
    waiter.available = true;
  }
  await waiter.save();

  return waiter;
}

module.exports = { assignWaiter, releaseOrder, BUSY_THRESHOLD };
