const mongoose = require('mongoose');
const Order    = require('../models/Order');
const Payment  = require('../models/Payment');
const Table    = require('../models/Table');

function getPeriodBounds(period) {
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (period) {
    case 'week':  return { start: new Date(today.getTime() - 7  * 24 * 60 * 60 * 1000), end: now };
    case 'month': return { start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000), end: now };
    default:      return { start: today, end: now };
  }
}

async function getDashboard(hotelId, period) {
  const { start, end } = getPeriodBounds(period);
  const hId = new mongoose.Types.ObjectId(hotelId);

  const [revenueAgg, revenueByDayAgg] = await Promise.all([
    Order.aggregate([
      { $match: { hotelId: hId, status: 'served', servedAt: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: '$bill.total' } } },
    ]),
    Order.aggregate([
      { $match: { hotelId: hId, status: 'served', servedAt: { $gte: start, $lte: end } } },
      { $group: {
          _id:    { $dateToString: { format: '%Y-%m-%d', date: '$servedAt' } },
          amount: { $sum: '$bill.total' },
        }
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', amount: 1, _id: 0 } },
    ]),
  ]);
  const totalRevenue = revenueAgg[0]?.total ?? 0;

  const orders = await Order.find({ hotelId: hId, createdAt: { $gte: start, $lte: end } }).lean();
  const byStatus = {
    served:    orders.filter(o => o.status === 'served').length,
    rejected:  orders.filter(o => o.status === 'rejected').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  };
  const servedOrders = orders.filter(o => o.status === 'served');
  const avgOrderValue = servedOrders.length
    ? Math.round(totalRevenue / servedOrders.length * 100) / 100
    : 0;

  const topItems = await Order.aggregate([
    { $match: { hotelId: hId, status: 'served', servedAt: { $gte: start, $lte: end } } },
    { $unwind: '$items' },
    { $group: {
        _id:         '$items.menuItemId',
        name:        { $first: '$items.name' },
        totalOrders: { $sum: '$items.quantity' },
        revenue:     { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
  ]);

  const peakHoursRaw = await Order.aggregate([
    { $match: { hotelId: hId, status: 'served', createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: { $hour: '$createdAt' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);
  const totalPeakOrders = peakHoursRaw.reduce((s, h) => s + h.count, 0);
  const peakHours = peakHoursRaw.map(h => ({
    hour:       h._id,
    orderCount: h.count,
    percentage: totalPeakOrders ? Math.round(h.count / totalPeakOrders * 100) : 0,
  }));

  const methodRaw = await Payment.aggregate([
    { $match: { hotelId: hId, status: 'received', receivedAt: { $gte: start, $lte: end } } },
    { $group: { _id: '$method', count: { $sum: 1 } } },
  ]);
  const totalPayments = methodRaw.reduce((s, m) => s + m.count, 0);
  const paymentMethods = { cash: 0, upi: 0, card: 0, gpay: 0, phonepay: 0 };
  for (const m of methodRaw) {
    paymentMethods[m._id] = totalPayments ? Math.round(m.count / totalPayments * 100) : 0;
  }

  const servedWithDates = servedOrders.filter(o => o.servedAt && o.placedAt);
  const avgTurnoverMinutes = servedWithDates.length
    ? Math.round(
        servedWithDates.reduce((s, o) =>
          s + (new Date(o.servedAt) - new Date(o.placedAt)) / 60000, 0
        ) / servedWithDates.length * 10
      ) / 10
    : 0;
  const tables = await Table.find({ hotelId: hId }).lean();
  const occupancyRate = tables.length
    ? Math.round(tables.filter(t => t.status === 'occupied').length / tables.length * 100)
    : 0;

  const waiterPerformance = await Order.aggregate([
    {
      $match: {
        hotelId:          hId,
        status:           'served',
        servedAt:         { $gte: start, $lte: end },
        assignedWaiterId: { $ne: null },
      },
    },
    {
      $addFields: {
        serveMinutes: {
          $cond: [
            { $and: ['$servedAt', '$placedAt'] },
            { $divide: [{ $subtract: ['$servedAt', '$placedAt'] }, 60000] },
            null,
          ],
        },
      },
    },
    {
      $group: {
        _id:          '$assignedWaiterId',
        served:       { $sum: 1 },
        avgServeTime: { $avg: '$serveMinutes' },
      },
    },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'w' } },
    { $unwind: { path: '$w', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        name:         '$w.name',
        served:       1,
        avgRating:    '$w.stats.avgRating',
        avgServeTime: { $round: ['$avgServeTime', 1] },
      },
    },
    { $sort: { served: -1 } },
  ]);

  const tableAgg = await Order.aggregate([
    { $match: { hotelId: hId, createdAt: { $gte: start, $lte: end } } },
    { $group: { _id: '$tableId', count: { $sum: 1 } } },
  ]);
  const repeatCustomerRate = tableAgg.length
    ? Math.round(tableAgg.filter(t => t.count > 1).length / tableAgg.length * 100)
    : 0;

  return {
    revenue:           { total: Math.round(totalRevenue * 100) / 100, byDay: revenueByDayAgg },
    orders:            { total: orders.length, byStatus },
    avgOrderValue,
    topItems,
    peakHours,
    paymentMethods,
    tableStats:        { avgTurnoverMinutes, occupancyRate },
    waiterPerformance,
    repeatCustomerRate,
  };
}

async function getRevenue(hotelId, from, to, groupBy = 'day') {
  const hId      = new mongoose.Types.ObjectId(hotelId);
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate   = to   ? new Date(to)   : new Date();

  let format;
  if      (groupBy === 'month') format = '%Y-%m';
  else if (groupBy === 'week')  format = '%G-W%V';
  else                          format = '%Y-%m-%d';

  const data = await Order.aggregate([
    { $match: { hotelId: hId, status: 'served', servedAt: { $gte: fromDate, $lte: toDate } } },
    { $group: {
        _id:        { $dateToString: { format, date: '$servedAt' } },
        revenue:    { $sum: '$bill.total' },
        orderCount: { $sum: 1 },
      }
    },
    { $sort: { _id: 1 } },
    { $project: { date: '$_id', revenue: 1, orderCount: 1, _id: 0 } },
  ]);

  return { data };
}

async function getItems(hotelId) {
  const hId = new mongoose.Types.ObjectId(hotelId);

  const items = await Order.aggregate([
    { $match: { hotelId: hId, status: 'served' } },
    { $unwind: '$items' },
    { $group: {
        _id:     '$items.menuItemId',
        name:    { $first: '$items.name' },
        orders:  { $sum: '$items.quantity' },
        revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
      }
    },
    { $lookup: { from: 'menuitems', localField: '_id', foreignField: '_id', as: 'mi' } },
    { $unwind: { path: '$mi', preserveNullAndEmptyArrays: true } },
    { $project: {
        name:      1,
        orders:    1,
        revenue:   1,
        avgRating: { $ifNull: ['$mi.stats.avgRating', 0] },
      }
    },
    { $sort: { revenue: -1 } },
  ]);

  return { items };
}

async function getOrdersForExport(hotelId, period) {
  const { start, end } = getPeriodBounds(period);
  const hId = new mongoose.Types.ObjectId(hotelId);

  return Order.find({ hotelId: hId, createdAt: { $gte: start, $lte: end } })
    .sort({ createdAt: -1 })
    .lean();
}

module.exports = { getDashboard, getRevenue, getItems, getOrdersForExport, getPeriodBounds };
