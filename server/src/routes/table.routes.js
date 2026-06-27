const router = require('express').Router();
const auth   = require('../middleware/auth');
const guard  = require('../middleware/roleGuard');
const {
  getPublicTables, getAllTables, createTable,
  updateTableStatus, addNote, deleteNote, getTableQR, assignWaiterToTable,
  getTableSession, checkoutTable, getTableHistory,
} = require('../controllers/table.controller');

// Public endpoint — static /:hotelId/public before dynamic /:tableId routes
router.get('/:hotelId/public', getPublicTables);

// Admin-only endpoints
router.get('/',                               auth, guard('admin'),           getAllTables);
router.post('/',                              auth, guard('admin'),           createTable);
router.patch('/:tableId/status',             auth, guard('admin'),           updateTableStatus);
router.post('/:tableId/notes',               auth, guard('admin', 'waiter'), addNote);
router.delete('/:tableId/notes/:noteIndex',  auth, guard('admin'),           deleteNote);
router.get('/:tableId/qr',                   auth, guard('admin'),           getTableQR);
router.patch('/:tableId/assign-waiter',      auth, guard('admin'),           assignWaiterToTable);
router.get('/:tableId/session',              auth, guard('admin', 'waiter'), getTableSession);
router.post('/:tableId/checkout',            auth, guard('admin', 'waiter'), checkoutTable);
router.get('/:tableId/history',              auth, guard('admin'),           getTableHistory);

module.exports = router;
