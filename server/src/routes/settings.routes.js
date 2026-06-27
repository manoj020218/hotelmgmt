const router = require('express').Router();
const auth   = require('../middleware/auth');
const guard  = require('../middleware/roleGuard');
const { upiUpload } = require('../config/storage');
const { toWebp }    = require('../config/imageProcessor');
const {
  getSettings, updateHotel, updateGst,
  updateOperations, updateKitchen, updatePayment, uploadUpiQr, updateWaiterMode,
} = require('../controllers/settings.controller');

const adminOnly = [auth, guard('admin')];

router.get('/',                    ...adminOnly, getSettings);
router.patch('/hotel',             ...adminOnly, updateHotel);
router.patch('/gst',               ...adminOnly, updateGst);
router.patch('/operations',        ...adminOnly, updateOperations);
router.patch('/kitchen',           ...adminOnly, updateKitchen);
router.patch('/payment',           ...adminOnly, updatePayment);
router.post('/upi-qr',      ...adminOnly, upiUpload.single('qrImage'), toWebp({ maxWidth: 600, quality: 85 }), uploadUpiQr);
router.patch('/waiter-mode', ...adminOnly, updateWaiterMode);

module.exports = router;
