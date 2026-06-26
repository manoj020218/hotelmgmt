const Order  = require('../models/Order');
const Table  = require('../models/Table');
const { assignWaiter, releaseOrder } = require('../services/waiterAssign.service');
const { emitToHotel }                = require('../socket/socketHandler');
const { sendToToken }                = require('../services/fcm.service');

// ── GET /api/kds/orders ───────────────────────────────────────────────────────
async function getKdsOrders(req, res, next) {
  try {
    const orders = await Order.find({
      hotelId:   req.user.hotelId,
      kdsStatus: { $in: ['new', 'accepted', 'preparing'] },
    })
      .populate('assignedWaiterId', 'name')
      .sort({ createdAt: 1 });

    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/kds/:orderId/accept ────────────────────────────────────────────
async function acceptOrder(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, hotelId: req.user.hotelId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.kdsStatus !== 'new') {
      return res.status(409).json({ error: `Order already ${order.kdsStatus}` });
    }

    order.kdsStatus = 'accepted';
    order.status    = 'preparing';

    // Assign waiter now if not already done at order-placement
    if (!order.assignedWaiterId) {
      const result = await assignWaiter(order.hotelId, order._id);
      if (result.waiter) {
        order.assignedWaiterId = result.waiter._id;
        order.assignedAt       = new Date();
      }
    }

    await order.save();

    // Reload with waiter's FCM token
    await order.populate('assignedWaiterId', 'name fcmToken');

    emitToHotel(order.hotelId, 'order:kds_accepted', {
      orderId:     order._id,
      tableNumber: order.tableNumber,
    });

    const waiterToken = order.assignedWaiterId ? order.assignedWaiterId.fcmToken : '';
    if (waiterToken) {
      sendToToken(waiterToken, {
        title: 'Order Accepted',
        body:  `Table ${order.tableNumber} — order accepted by kitchen`,
      }, {}).catch(() => {});
    }

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/kds/:orderId/reject ────────────────────────────────────────────
async function rejectOrder(req, res, next) {
  try {
    const { reason } = req.body;

    const order = await Order.findOne({ _id: req.params.orderId, hotelId: req.user.hotelId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!['new', 'accepted'].includes(order.kdsStatus)) {
      return res.status(409).json({ error: `Cannot reject order with kdsStatus '${order.kdsStatus}'` });
    }

    order.kdsStatus       = 'rejected';
    order.status          = 'rejected';
    order.rejectionReason = reason || 'Rejected by kitchen';

    // Release waiter
    if (order.assignedWaiterId) {
      await releaseOrder(order.assignedWaiterId, order._id);
    }

    // Free table
    await Table.findByIdAndUpdate(order.tableId, {
      status:         'available',
      currentOrderId: null,
    });

    await order.save();

    emitToHotel(order.hotelId, 'order:kds_rejected', {
      orderId:     order._id,
      tableNumber: order.tableNumber,
      reason:      order.rejectionReason,
    });

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/kds/:orderId/ready ─────────────────────────────────────────────
async function markReady(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, hotelId: req.user.hotelId });
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.kdsStatus !== 'accepted') {
      return res.status(409).json({ error: `Cannot mark ready from kdsStatus '${order.kdsStatus}'` });
    }

    order.kdsStatus = 'ready';
    order.status    = 'ready';
    await order.save();

    await order.populate('assignedWaiterId', 'name fcmToken');

    emitToHotel(order.hotelId, 'order:ready', {
      orderId:     order._id,
      tableNumber: order.tableNumber,
    });

    const waiterToken = order.assignedWaiterId ? order.assignedWaiterId.fcmToken : '';
    if (waiterToken) {
      sendToToken(waiterToken, {
        title: '🔔 Order Ready',
        body:  `Table ${order.tableNumber} — pick up now!`,
      }, {}).catch(() => {});
    }

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

module.exports = { getKdsOrders, acceptOrder, rejectOrder, markReady };
