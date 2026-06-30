const router = require('express').Router();
const auth   = require('../middleware/auth');
const guard  = require('../middleware/roleGuard');

const {
  generateDeleteCode,
  getOrderRecords,
  deleteAllRecords,
  deleteBeforeDate,
} = require('../controllers/records.controller');

// External Super Admin call — no JWT, uses x-superadmin-secret header
router.post('/generate-delete-code', generateDeleteCode);

// Admin only
router.get('/orders',        auth, guard('admin'), getOrderRecords);
router.delete('/all',        auth, guard('admin'), deleteAllRecords);
router.delete('/before-date', auth, guard('admin'), deleteBeforeDate);

module.exports = router;
