const router = require('express').Router();
const auth   = require('../middleware/auth');
const guard  = require('../middleware/roleGuard');
const { getTableQR } = require('../controllers/table.controller');

// GET /api/qr/:tableId — admin convenience endpoint to fetch QR info by tableId
router.get('/:tableId', auth, guard('admin'), getTableQR);

module.exports = router;
