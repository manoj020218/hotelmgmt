const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  adminLogin, waiterLogin, kitchenLogin,
  refresh, logout, me, saveFcmToken,
} = require('../controllers/auth.controller');

router.post('/admin/login',   adminLogin);
router.post('/waiter/login',  waiterLogin);
router.post('/kitchen/login', kitchenLogin);
router.post('/refresh',       refresh);
router.post('/logout',        auth, logout);
router.get('/me',             auth, me);
router.post('/fcm-token',     auth, saveFcmToken);

module.exports = router;
