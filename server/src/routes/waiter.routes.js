const router = require('express').Router();
const auth   = require('../middleware/auth');
const guard  = require('../middleware/roleGuard');
const {
  getAllWaiters, createWaiter, updateWaiter,
  toggleAvailability, deleteWaiter, getWaiterOrders,
} = require('../controllers/waiter.controller');

router.get('/',                                  auth, guard('admin'),           getAllWaiters);
router.post('/',                                 auth, guard('admin'),           createWaiter);

// More-specific /:waiterId/xxx before /:waiterId to avoid confusion
router.patch('/:waiterId/availability',          auth, guard('admin', 'waiter'), toggleAvailability);
router.get('/:waiterId/orders',                  auth, guard('admin'),           getWaiterOrders);

router.patch('/:waiterId',                       auth, guard('admin'),           updateWaiter);
router.delete('/:waiterId',                      auth, guard('admin'),           deleteWaiter);

module.exports = router;
