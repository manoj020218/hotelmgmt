const { getDashboard, getRevenue, getItems, getOrdersForExport, getPeriodBounds } = require('../services/analytics.service');

async function dashboard(req, res, next) {
  try {
    const data = await getDashboard(req.user.hotelId.toString(), req.query.period || 'today');
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function revenue(req, res, next) {
  try {
    const { from, to, groupBy = 'day', period } = req.query;
    let fromDate = from;
    let toDate   = to;
    if (!from && !to && period) {
      const bounds = getPeriodBounds(period);
      fromDate = bounds.start.toISOString();
      toDate   = bounds.end.toISOString();
    }
    const data = await getRevenue(req.user.hotelId.toString(), fromDate, toDate, groupBy);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function items(req, res, next) {
  try {
    const data = await getItems(req.user.hotelId.toString());
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function exportCSV(req, res, next) {
  try {
    const period = req.query.period || 'week';
    const orders = await getOrdersForExport(req.user.hotelId.toString(), period);

    const headers = ['orderId', 'tableNumber', 'status', 'total', 'createdAt'];
    const rows    = orders.map(o => [
      o._id.toString(),
      o.tableNumber,
      o.status,
      o.bill.total,
      new Date(o.createdAt).toISOString(),
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${period}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

module.exports = { dashboard, revenue, items, exportCSV };
