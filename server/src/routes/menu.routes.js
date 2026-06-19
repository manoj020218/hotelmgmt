const router = require('express').Router();
const auth = require('../middleware/auth');
const guard = require('../middleware/roleGuard');
const { menuUpload } = require('../config/storage');
const {
  adminGetAll, getMenu, getItem,
  createItem, updateItem, toggleAvailability, deleteItem,
} = require('../controllers/menu.controller');

// Static /admin/all BEFORE dynamic /:hotelId — prevents Express treating "admin" as a hotelId
router.get('/admin/all', auth, guard('admin'), adminGetAll);

router.get('/:hotelId', getMenu);
router.get('/:hotelId/item/:itemId', getItem);

router.post('/', auth, guard('admin'), menuUpload.single('photo'), createItem);

// More-specific /:itemId/availability BEFORE /:itemId to avoid shadowing
router.patch('/:itemId/availability', auth, guard('admin'), toggleAvailability);
router.patch('/:itemId', auth, guard('admin'), updateItem);

router.delete('/:itemId', auth, guard('admin'), deleteItem);

module.exports = router;
