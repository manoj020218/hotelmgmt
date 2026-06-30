const { v4: uuidv4 } = require('uuid');

const Order      = require('../models/Order');
const Table      = require('../models/Table');
const Hotel      = require('../models/Hotel');
const MenuItem   = require('../models/MenuItem');

const { calculateBill }              = require('../services/gst.service');
const { emitToHotel, emitToOrder }   = require('../socket/socketHandler');

// Helper: compute current IST operating-day start (UTC)
function dayStartUTC(hotel) {
  const [h, m]   = (hotel.settings?.hotelStartTime || '09:00').split(':').map(Number);
  const nowUTC   = new Date();
  const istMs    = 5.5 * 60 * 60 * 1000;
  const nowIST   = new Date(nowUTC.getTime() + istMs);
  const boundary = new Date(nowIST);
  boundary.setHours(h, m, 0, 0);
  const boundaryUTC = new Date(boundary.getTime() - istMs);
  if (boundaryUTC > nowUTC) boundaryUTC.setDate(boundaryUTC.getDate() - 1);
  return boundaryUTC;
}

// ── GET /api/orders/waiter-tables ─────────────────────────────────────────────
// Returns tables list for waiter to pick from when placing an order
async function getTablesForOrder(req, res, next) {
  try {
    const Table  = require('../models/Table');
    const tables = await Table.find({ hotelId: req.user.hotelId })
      .select('tableNumber status capacity qrToken')
      .sort({ tableNumber: 1 });
    res.json({ tables });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/orders/waiter-menu/:tableId ─────────────────────────────────────
// Returns menu items (text-only, no heavy image fields) for waiter order form
async function getMenuForWaiterOrder(req, res, next) {
  try {
    const table = await Table.findOne({ _id: req.params.tableId, hotelId: req.user.hotelId });
    if (!table) return res.status(404).json({ error: 'Table not found' });

    const items = await MenuItem.find({ hotelId: req.user.hotelId, available: true })
      .select('name description price halfPrice courseType category available customizationGroups')
      .sort({ courseType: 1, name: 1 });

    res.json({ items, table });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/orders/waiter-place ─────────────────────────────────────────────
// Waiter places an order on behalf of a customer at a table
async function placeWaiterOrder(req, res, next) {
  try {
    const { tableId, items: reqItems } = req.body;

    if (!tableId || !reqItems?.length) {
      return res.status(400).json({ error: 'tableId and items are required' });
    }

    const table = await Table.findOne({ _id: tableId, hotelId: req.user.hotelId });
    if (!table) return res.status(404).json({ error: 'Table not found' });

    if (table.status === 'blocked') {
      return res.status(409).json({ error: 'Table is blocked' });
    }

    const hotel = await Hotel.findById(table.hotelId);
    if (!hotel) return res.status(404).json({ error: 'Hotel not found' });

    // Validate menu items
    const menuItemIds = reqItems.map(i => i.menuItemId);
    const menuItems   = await MenuItem.find({ _id: { $in: menuItemIds }, hotelId: table.hotelId });
    if (menuItems.length !== menuItemIds.length) {
      return res.status(400).json({ error: 'One or more menu items not found' });
    }

    const unavailable = menuItems.filter(m => !m.available);
    if (unavailable.length) {
      return res.status(400).json({ error: `Unavailable: ${unavailable.map(m => m.name).join(', ')}` });
    }

    // Build validated items
    const menuMap     = Object.fromEntries(menuItems.map(m => [m._id.toString(), m]));
    const validItems  = reqItems.map(ri => {
      const mi    = menuMap[ri.menuItemId.toString()];
      const price = ri.half && mi.halfPrice ? mi.halfPrice : mi.price;
      return {
        menuItemId:     mi._id,
        name:           mi.name,
        price,
        quantity:       Math.max(1, Number(ri.quantity) || 1),
        customizations: ri.customizations ?? [],
        specialNote:    ri.specialNote   ?? '',
      };
    });

    const bill      = calculateBill(validItems, hotel);
    const sessionId = uuidv4(); // waiter-initiated orders get a server-generated session

    const isNewSession = !['occupied', 'bill_pending'].includes(table.status);

    const order = await Order.create({
      hotelId:     table.hotelId,
      tableId:     table._id,
      tableNumber: table.tableNumber,
      sessionId,
      items:       validItems,
      status:      'placed',
      bill,
      placedBy: {
        userId: req.user._id,
        name:   req.user.name,
        role:   req.user.role,
      },
    });

    // Update table
    const tableUpdate = {
      status:         'occupied',
      currentOrderId: order._id,
      hasNewOrder:    !isNewSession,
    };
    if (isNewSession) {
      tableUpdate.sessionStartedAt = new Date();
      tableUpdate.sessionBillTotal = 0;
    }
    await Table.findByIdAndUpdate(table._id, tableUpdate);

    emitToHotel(table.hotelId, 'table:status', {
      tableId:          table._id,
      tableNumber:      table.tableNumber,
      status:           'occupied',
      hasNewOrder:      !isNewSession,
      sessionBillTotal: isNewSession ? 0 : (table.sessionBillTotal ?? 0),
    });

    const orderForEmit = order.toObject();
    emitToHotel(table.hotelId, 'order:new', { order: orderForEmit });

    res.status(201).json({ order, sessionId, bill });
  } catch (err) {
    next(err);
  }
}

module.exports = { getTablesForOrder, getMenuForWaiterOrder, placeWaiterOrder };
