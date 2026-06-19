const router = require('express').Router();
const auth   = require('../middleware/auth');
const guard  = require('../middleware/roleGuard');
const {
  createFeedback,
  adminGetFeedbacks,
  waiterGetFeedback,
  hotelSummary,
} = require('../controllers/feedback.controller');

// Static paths must come before dynamic /:param routes
router.get('/admin/all',              auth, guard('admin'),  adminGetFeedbacks);
router.get('/waiter/mine',            auth, guard('waiter'), waiterGetFeedback);
router.get('/hotel/:hotelId/summary',                        hotelSummary);

router.post('/', createFeedback);

module.exports = router;
