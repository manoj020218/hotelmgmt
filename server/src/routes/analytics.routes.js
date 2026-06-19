const router = require('express').Router();
const auth   = require('../middleware/auth');
const guard  = require('../middleware/roleGuard');
const { dashboard, revenue, items, exportCSV } = require('../controllers/analytics.controller');

router.get('/dashboard', auth, guard('admin'), dashboard);
router.get('/revenue',   auth, guard('admin'), revenue);
router.get('/items',     auth, guard('admin'), items);
router.get('/export',    auth, guard('admin'), exportCSV);

module.exports = router;
