const router = require('express').Router();
const auth   = require('../middleware/auth');
const guard  = require('../middleware/roleGuard');

const {
  getPaymentByOrder, markReceived, getReceipt,
  disputePayment, todayPayments,
} = require('../controllers/payment.controller');

// Static routes BEFORE dynamic /:paymentId
router.get('/admin/today',                 auth, guard('admin'),           todayPayments);
router.get('/order/:orderId',              getPaymentByOrder);

router.patch('/:paymentId/mark-received',  auth, guard('waiter', 'admin'), markReceived);
router.get('/:paymentId/receipt',          getReceipt);
router.post('/:paymentId/dispute',         auth, guard('admin'),           disputePayment);

module.exports = router;
