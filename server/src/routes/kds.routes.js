const router = require('express').Router();
const auth   = require('../middleware/auth');
const guard  = require('../middleware/roleGuard');
const { getKdsOrders, acceptOrder, rejectOrder, markReady } = require('../controllers/kds.controller');

// Admin can also access the KDS to monitor / override
router.get('/',                     auth, guard('kitchen', 'admin'), getKdsOrders);
router.patch('/:orderId/accept',    auth, guard('kitchen', 'admin'), acceptOrder);
router.patch('/:orderId/reject',    auth, guard('kitchen', 'admin'), rejectOrder);
router.patch('/:orderId/ready',     auth, guard('kitchen', 'admin'), markReady);

module.exports = router;
