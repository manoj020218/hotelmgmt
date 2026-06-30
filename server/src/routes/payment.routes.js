const router = require('express').Router();
const auth   = require('../middleware/auth');
const guard  = require('../middleware/roleGuard');

const {
  requestPayment, getPendingPayments,
  getPaymentByOrder, markReceived, getReceipt,
  disputePayment, todayPayments, getPaymentHistory,
} = require('../controllers/payment.controller');

// Static routes BEFORE dynamic /:paymentId
router.post('/request/:orderId',           requestPayment);                              // customer (sessionId) or staff
router.get('/pending',                     auth, guard('admin', 'waiter'), getPendingPayments);
router.get('/admin/today',                 auth, guard('admin'),           todayPayments);
router.get('/history',                     auth, guard('admin'),           getPaymentHistory);
router.get('/order/:orderId',              getPaymentByOrder);

router.patch('/:paymentId/mark-received',  auth, guard('waiter', 'admin'), markReceived);
router.get('/:paymentId/receipt',          auth, guard('waiter', 'admin'), getReceipt);
router.post('/:paymentId/dispute',         auth, guard('admin'),           disputePayment);

module.exports = router;
