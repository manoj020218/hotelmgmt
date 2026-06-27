const router = require('express').Router();
const auth   = require('../middleware/auth');
const guard  = require('../middleware/roleGuard');

const {
  placeOrder, getOrder, getOrderByTable, modifyOrder,
  updateStatus, adminLiveOrders, waiterOrders, orderHistory,
  assignOrderWaiter, claimOrder,
} = require('../controllers/order.controller');

// Static multi-segment routes BEFORE dynamic /:orderId
router.get('/admin/live',              auth, guard('admin'),           adminLiveOrders);
router.get('/waiter/mine',             auth, guard('waiter'),          waiterOrders);
router.get('/table/:tableQrToken',     getOrderByTable);
router.get('/history/:tableQrToken',   orderHistory);

router.post('/',                       placeOrder);
router.get('/:orderId',                getOrder);
router.patch('/:orderId/modify',         modifyOrder);
router.patch('/:orderId/status',         auth, guard('waiter', 'admin'), updateStatus);
router.patch('/:orderId/assign-waiter',  auth, guard('admin'),           assignOrderWaiter);
router.patch('/:orderId/claim',          auth, guard('waiter'),           claimOrder);

module.exports = router;
