const mongoose = require('mongoose');
const Feedback = require('../models/Feedback');
const Order    = require('../models/Order');
const User     = require('../models/User');
const MenuItem = require('../models/MenuItem');

// ── POST /api/feedback ────────────────────────────────────────────────────────
async function createFeedback(req, res, next) {
  try {
    const { orderId, sessionId, ratings, comment } = req.body;

    if (!orderId || !sessionId || !ratings?.overall) {
      return res.status(400).json({ error: 'orderId, sessionId, and ratings.overall are required' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.sessionId !== sessionId) return res.status(403).json({ error: 'Invalid session' });

    const existing = await Feedback.findOne({ orderId });
    if (existing) return res.status(409).json({ error: 'Feedback already submitted for this order' });

    const feedback = await Feedback.create({
      hotelId:  order.hotelId,
      orderId,
      tableId:  order.tableId,
      waiterId: order.assignedWaiterId || undefined,
      ratings,
      comment:  comment || '',
    });

    // Rolling average update for waiter
    if (order.assignedWaiterId && ratings.waiter) {
      const waiter = await User.findById(order.assignedWaiterId);
      if (waiter) {
        const count  = waiter.stats.ratingCount;
        const newAvg = Math.round(
          ((waiter.stats.avgRating * count + ratings.waiter) / (count + 1)) * 100
        ) / 100;
        await User.findByIdAndUpdate(order.assignedWaiterId, {
          'stats.avgRating':   newAvg,
          'stats.ratingCount': count + 1,
        });
      }
    }

    // Update MenuItem avgRating for each ordered item
    if (ratings.food && order.items?.length) {
      for (const item of order.items) {
        const mi = await MenuItem.findById(item.menuItemId);
        if (mi) {
          const newAvg = mi.stats.avgRating > 0
            ? Math.round(((mi.stats.avgRating + ratings.food) / 2) * 100) / 100
            : ratings.food;
          await MenuItem.findByIdAndUpdate(item.menuItemId, { 'stats.avgRating': newAvg });
        }
      }
    }

    res.status(201).json({ feedback });
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    next(err);
  }
}

// ── GET /api/feedback/admin/all ───────────────────────────────────────────────
async function adminGetFeedbacks(req, res, next) {
  try {
    const { waiterId, dateFrom, dateTo, rating } = req.query;
    const filter = { hotelId: req.user.hotelId };

    if (waiterId)             filter.waiterId = waiterId;
    if (dateFrom || dateTo) {
      filter.submittedAt = {};
      if (dateFrom) filter.submittedAt.$gte = new Date(dateFrom);
      if (dateTo)   filter.submittedAt.$lte = new Date(dateTo);
    }
    if (rating) filter['ratings.overall'] = parseInt(rating, 10);

    const feedbacks = await Feedback.find(filter)
      .populate('waiterId', 'name stats')
      .sort({ submittedAt: -1 });

    // Compute per-category averages
    let waiterSum = 0, waiterN = 0, foodSum = 0, foodN = 0, overallSum = 0, overallN = 0;
    for (const f of feedbacks) {
      if (f.ratings.waiter)  { waiterSum  += f.ratings.waiter;  waiterN++;  }
      if (f.ratings.food)    { foodSum    += f.ratings.food;    foodN++;    }
      if (f.ratings.overall) { overallSum += f.ratings.overall; overallN++; }
    }
    const avgRatings = {
      waiter:  waiterN  ? Math.round(waiterSum  / waiterN  * 100) / 100 : 0,
      food:    foodN    ? Math.round(foodSum    / foodN    * 100) / 100 : 0,
      overall: overallN ? Math.round(overallSum / overallN * 100) / 100 : 0,
    };

    const waiterLeaderboard = await User.find({
      hotelId: req.user.hotelId,
      role:    'waiter',
    })
      .select('name stats.avgRating stats.ratingCount')
      .sort({ 'stats.avgRating': -1 });

    res.json({ feedbacks, avgRatings, waiterLeaderboard });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/feedback/waiter/mine ─────────────────────────────────────────────
async function waiterGetFeedback(req, res, next) {
  try {
    const myFeedbacks = await Feedback.find({ waiterId: req.user._id })
      .sort({ submittedAt: -1 });

    const ratingBreakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const f of myFeedbacks) {
      const r = f.ratings.waiter;
      if (r >= 1 && r <= 5) ratingBreakdown[r]++;
    }

    const waiter = await User.findById(req.user._id).select('stats');
    res.json({
      myFeedbacks,
      myStats: {
        avgRating:       waiter?.stats.avgRating ?? 0,
        totalReviews:    myFeedbacks.length,
        ratingBreakdown,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/feedback/hotel/:hotelId/summary ──────────────────────────────────
async function hotelSummary(req, res, next) {
  try {
    const agg = await Feedback.aggregate([
      { $match: { hotelId: new mongoose.Types.ObjectId(req.params.hotelId) } },
      {
        $group: {
          _id:        null,
          avgOverall: { $avg: '$ratings.overall' },
          count:      { $sum: 1 },
        },
      },
    ]);

    if (!agg.length) return res.json({ avgOverall: 0, totalReviews: 0 });
    res.json({
      avgOverall:   Math.round(agg[0].avgOverall * 100) / 100,
      totalReviews: agg[0].count,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { createFeedback, adminGetFeedbacks, waiterGetFeedback, hotelSummary };
