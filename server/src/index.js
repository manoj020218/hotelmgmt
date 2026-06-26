require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const http        = require('http');
const path        = require('path');
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');
const { Server } = require('socket.io');

const { connectDB }        = require('./config/db');
const { initFirebase }     = require('./config/firebase');
const { initSocket }       = require('./socket/socketHandler');
const { ensureUploadDirs } = require('./config/storage');
const errorHandler         = require('./middleware/errorHandler');

const authRoutes      = require('./routes/auth.routes');
const menuRoutes      = require('./routes/menu.routes');
const orderRoutes     = require('./routes/order.routes');
const kdsRoutes       = require('./routes/kds.routes');
const paymentRoutes   = require('./routes/payment.routes');
const tableRoutes     = require('./routes/table.routes');
const waiterRoutes    = require('./routes/waiter.routes');
const qrRoutes        = require('./routes/qr.routes');
const feedbackRoutes  = require('./routes/feedback.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const settingsRoutes  = require('./routes/settings.routes');

const ALLOWED_ORIGINS = (process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(s => s.trim()).filter(Boolean);

const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  max:              30,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many requests, please try again later' },
});

const apiLimiter = rateLimit({
  windowMs:         60 * 1000,
  max:              300,
  standardHeaders:  true,
  legacyHeaders:    false,
  message:          { error: 'Too many requests, please try again later' },
});

function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin '${origin}' not allowed`));
    },
    credentials: true,
  }));
  app.use(morgan('dev'));
  app.use(express.json());

  const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '../uploads');
  app.use('/uploads', express.static(uploadsDir));

  app.use('/api/auth',      authLimiter, authRoutes);
  app.use('/api',           apiLimiter);
  app.use('/api/menu',      menuRoutes);
  app.use('/api/orders',    orderRoutes);
  app.use('/api/kds',       kdsRoutes);
  app.use('/api/payments',  paymentRoutes);
  app.use('/api/tables',    tableRoutes);
  app.use('/api/waiters',   waiterRoutes);
  app.use('/api/qr',        qrRoutes);
  app.use('/api/feedback',  feedbackRoutes);
  app.use('/api/analytics', analyticsRoutes);
  app.use('/api/settings',  settingsRoutes);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() })
  });

  app.use(errorHandler);

  return app;
}

module.exports = { createApp };

if (require.main === module) {
  (async () => {
    await connectDB();
    initFirebase();
    ensureUploadDirs();

    const app    = createApp();
    const server = http.createServer(app);
    const io     = new Server(server, { cors: { origin: ALLOWED_ORIGINS, credentials: true } });
    initSocket(io);

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT}`);
    });
  })();
}
