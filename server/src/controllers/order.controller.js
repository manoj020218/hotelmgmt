const jwt      = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const Order    = require('../models/Order');
const Table    = require('../models/Table');
const Hotel    = require('../models/Hotel');
const MenuItem = require('../models/MenuItem');
const Payment  = require('../models/Payment');
const User     = require('../models/User');

const { calculateBill }          = require('../services/gst.service');
const { assignWaiter, releaseOrder } = require('../services/waiterAssign.service');
const { emitToHotel, emitToOrder } = require('../socket/socketHandler');
const { sendToToken, sendToTopic } = require('../services/fcm.service');

// ── POST /api/orders ─────────────────────────────────────────────────────────
async function placeOrder(req, res, next) {
  try {
    const { tableQrToken, items: reqItems } = req.body;

    if (!tableQrToken || !reqItems || !reqItems.length) {
      return res.status(400).json({ error: 'tableQrToken and items are required' });
    }

    const table = await Table.findOne({ qrToken: tableQrToken });
    if (!table) return res.status(404).json({ error: 'Invalid QR token' });

    if (table.status === 'occupied') {
      return res.status(409).json({ error: 'Table already has an active order' });
    }

    const hotel = await Hotel.findById(table.hotelId);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    if (!hotel.settings.kitchenOpen) {
      return res.status(503).json({ error: 'Kitchen is closed — not accepting orders' });
    }

    // Validate menu items
    const menuItemIds = reqItems.map(i => i.menuItemId);
    const menuItems   = await MenuItem.find({ _id: { $in: menuItemIds }, hotelId: table.hotelId });

    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ error: 'One or more menu items not found' });
    }

    const unavailable = menuItems.filter(m => !m.available);
    if (unavailable.length > 0) {
      return res.status(400).json({ error: `Menu items unavailable: ${unavailable.map(m => m.name).join(', ')}` });
    }

    // Build order items with denormalised name + price
    const menuMap = {};
    menuItems.forEach(m => { menuMap[m._id.toString()] = m; });

    const orderItems = reqItems.map(i => ({
      menuItemId:    i.menuItemId,
      name:          menuMap[i.menuItemId.toString()].name,
      price:         menuMap[i.menuItemId.toString()].price,
      quantity:      i.quantity || 1,
      customizations: i.customizations || [],
      specialNote:   i.specialNote || '',
    }));

    const bill      = calculateBill(orderItems, hotel);
    const sessionId = uuidv4();

    const order = await Order.create({
      hotelId:     table.hotelId,
      tableId:     table._id,
      tableNumber: table.tableNumber,
      sessionId,
      items:       orderItems,
      bill,
      status:      'placed',
    });

    // Update table status
    await Table.findByIdAndUpdate(table._id, {
      status:         'occupied',
      currentOrderId: order._id,
    });

    // Assign waiter based on hotel's waiterMode
    let assignedWaiter = null;
    const waiterMode = hotel.settings.waiterMode || 'table';

    if (waiterMode === 'table' && table.assignedWaiterId) {
      assignedWaiter = await User.findOne({ _id: table.assignedWaiterId, isActive: true });
      if (assignedWaiter) {
        await Order.findByIdAndUpdate(order._id, {
          assignedWaiterId: assignedWaiter._id,
          assignedAt:       new Date(),
          status:           'assigned',
        });
        assignedWaiter.activeOrderIds.push(order._id);
        await assignedWaiter.save();
      }
    }
    // 'manual' and 'claim' modes: order stays 'placed', assigned later

    // Socket emit — clients expect { order } with full order object
    const orderForEmit = order.toObject();
    if (assignedWaiter) {
      orderForEmit.assignedWaiterId = { _id: assignedWaiter._id, name: assignedWaiter.name };
      orderForEmit.status    = 'assigned';
      orderForEmit.assignedAt = new Date();
    }
    emitToHotel(table.hotelId, 'order:new', { order: orderForEmit });

    if (assignedWaiter) {
      const assignPayload = {
        orderId:    order._id,
        waiterId:   assignedWaiter._id,
        waiterName: assignedWaiter.name,
      };
      emitToHotel(table.hotelId, 'order:assigned', assignPayload);
      emitToOrder(order._id,     'order:assigned', assignPayload);
    }

    // FCM (fire-and-forget, never throw)
    sendToTopic(hotel.fcmTopics && hotel.fcmTopics.admin, { title: 'New Order', body: `Table ${table.tableNumber}` }, {}).catch(() => {});

    return res.status(201).json({
      orderId:  order._id,
      sessionId,
      bill,
      assignedWaiter: assignedWaiter
        ? { id: assignedWaiter._id, name: assignedWaiter.name }
        : null,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/orders/:orderId ─────────────────────────────────────────────────
async function getOrder(req, res, next) {
  try {
    const order = await Order.findById(req.params.orderId)
      .populate('assignedWaiterId', 'name phone');

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Allow access if authenticated OR if sessionId matches
    const authHeader = req.headers.authorization;
    let isAuth = false;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
        isAuth = true;
      } catch {}
    }

    const sessionMatch = req.query.sessionId && req.query.sessionId === order.sessionId;
    if (!isAuth && !sessionMatch) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/orders/table/:tableQrToken ──────────────────────────────────────
async function getOrderByTable(req, res, next) {
  try {
    const table = await Table.findOne({ qrToken: req.params.tableQrToken });
    if (!table || !table.currentOrderId) return res.json({ order: null });

    const order = await Order.findById(table.currentOrderId)
      .populate('assignedWaiterId', 'name');
    res.json({ order });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/orders/:orderId/modify ────────────────────────────────────────
async function modifyOrder(req, res, next) {
  try {
    const { addItems, sessionId } = req.body;
    if (!addItems || !addItems.length) {
      return res.status(400).json({ error: 'addItems is required' });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Require sessionId (customer) or a valid JWT (staff)
    const authHeader = req.headers.authorization;
    let isAuth = false;
    if (authHeader?.startsWith('Bearer ')) {
      try { jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET); isAuth = true; } catch {}
    }
    if (!isAuth && sessionId !== order.sessionId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!['placed', 'assigned'].includes(order.status)) {
      return res.status(400).json({ error: 'Order cannot be modified in current status' });
    }

    const hotel     = await Hotel.findById(order.hotelId);
    const windowMs  = (hotel.settings.orderModificationWindow || 5) * 60 * 1000;
    const elapsed   = Date.now() - new Date(order.placedAt).getTime();
    if (elapsed > windowMs) {
      return res.status(400).json({ error: 'Modification window has closed' });
    }

    // Validate added items
    const newIds      = addItems.map(i => i.menuItemId);
    const newMenuItems = await MenuItem.find({ _id: { $in: newIds }, hotelId: order.hotelId, available: true });
    if (newMenuItems.length !== newIds.length) {
      return res.status(400).json({ error: 'One or more added items are invalid or unavailable' });
    }

    const menuMap = {};
    newMenuItems.forEach(m => { menuMap[m._id.toString()] = m; });

    const newOrderItems = addItems.map(i => ({
      menuItemId:    i.menuItemId,
      name:          menuMap[i.menuItemId.toString()].name,
      price:         menuMap[i.menuItemId.toString()].price,
      quantity:      i.quantity || 1,
      customizations: i.customizations || [],
      specialNote:   i.specialNote || '',
    }));

    order.items.push(...newOrderItems);
    order.bill = calculateBill(order.items, hotel);
    order.modifications.push({
      type:       'add_item',
      item:       newOrderItems,
      modifiedBy: 'customer',
      modifiedAt: new Date(),
    });

    await order.save();

    emitToHotel(order.hotelId, 'order:modified', { orderId: order._id, bill: order.bill });

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/orders/:orderId/status ────────────────────────────────────────
async function updateStatus(req, res, next) {
  try {
    const { status, rejectionReason } = req.body;
    if (!['served', 'rejected', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const ALLOWED_TRANSITIONS = {
      served:    ['placed', 'assigned', 'preparing', 'ready'],
      rejected:  ['placed', 'assigned', 'preparing'],
      cancelled: ['placed', 'assigned'],
    };
    if (!ALLOWED_TRANSITIONS[status].includes(order.status)) {
      return res.status(409).json({ error: `Cannot transition from '${order.status}' to '${status}'` });
    }

    order.status = status;
    if (rejectionReason) order.rejectionReason = rejectionReason;

    let payment = null;

    if (status === 'served') {
      order.servedAt = new Date();

      await Table.findByIdAndUpdate(order.tableId, {
        status:         'available',
        currentOrderId: null,
      });

      await releaseOrder(order.assignedWaiterId, order._id);

      if (!order.paymentId) {
        payment = await Payment.create({
          hotelId:     order.hotelId,
          orderId:     order._id,
          tableNumber: order.tableNumber,
          amount:      order.bill.total,
          status:      'pending',
        });
        order.paymentId = payment._id;
      }

      emitToHotel(order.hotelId, 'order:served', {
        orderId:     order._id,
        tableNumber: order.tableNumber,
      });
    } else if (status === 'rejected' || status === 'cancelled') {
      await Table.findByIdAndUpdate(order.tableId, {
        status:         'available',
        currentOrderId: null,
      });

      await releaseOrder(order.assignedWaiterId, order._id);

      emitToHotel(order.hotelId, 'order:rejected', {
        orderId:         order._id,
        rejectionReason: rejectionReason || '',
      });
    }

    await order.save();

    res.json({ order, payment });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/orders/admin/live ────────────────────────────────────────────────
async function adminLiveOrders(req, res, next) {
  try {
    const orders = await Order.find({
      hotelId: req.user.hotelId,
      status:  { $nin: ['served', 'cancelled', 'rejected'] },
    })
      .populate('assignedWaiterId', 'name')
      .sort({ placedAt: -1 });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/orders/waiter/mine ───────────────────────────────────────────────
async function waiterOrders(req, res, next) {
  try {
    const orders = await Order.find({
      assignedWaiterId: req.user._id,
      status:           { $nin: ['served', 'cancelled', 'rejected'] },
    }).sort({ placedAt: -1 });
    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/orders/history/:tableQrToken ────────────────────────────────────
async function orderHistory(req, res, next) {
  try {
    const table = await Table.findOne({ qrToken: req.params.tableQrToken });
    if (!table) return res.status(404).json({ error: 'Table not found' });

    const since = new Date(); since.setHours(0, 0, 0, 0);
    const orders = await Order.find({ tableId: table._id, createdAt: { $gte: since } })
      .sort({ createdAt: -1 })
      .limit(3);
    res.json({ orders });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/orders/:orderId/assign-waiter (Option B — admin manual assign) ─
async function assignOrderWaiter(req, res, next) {
  try {
    const { waiterId } = req.body;

    const order = await Order.findOneAndUpdate(
      { _id: req.params.orderId, hotelId: req.user.hotelId },
      {
        assignedWaiterId: waiterId || null,
        assignedAt:       waiterId ? new Date() : null,
        status:           waiterId ? 'assigned' : 'placed',
      },
      { new: true }
    ).populate('assignedWaiterId', 'name phone');

    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (waiterId) {
      emitToHotel(order.hotelId, 'order:assigned', {
        orderId:    order._id,
        waiterId,
        waiterName: order.assignedWaiterId?.name,
      });
    }

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/orders/:orderId/claim (Option C — waiter self-claims) ──────────
async function claimOrder(req, res, next) {
  try {
    const order = await Order.findOne({ _id: req.params.orderId, hotelId: req.user.hotelId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.assignedWaiterId) return res.status(409).json({ error: 'Order already claimed' });

    order.assignedWaiterId = req.user._id;
    order.assignedAt       = new Date();
    order.status           = 'assigned';
    await order.save();

    req.user.activeOrderIds.push(order._id);
    await req.user.save();

    emitToHotel(order.hotelId, 'order:assigned', {
      orderId:    order._id,
      waiterId:   req.user._id,
      waiterName: req.user.name,
    });

    res.json({ order });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  placeOrder, getOrder, getOrderByTable, modifyOrder,
  updateStatus, adminLiveOrders, waiterOrders, orderHistory,
  assignOrderWaiter, claimOrder,
};
