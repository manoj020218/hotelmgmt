const mongoose = require('mongoose');

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

async function connectDB(retries = MAX_RETRIES, delayMs = RETRY_DELAY_MS) {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('[DB] MongoDB connected:', mongoose.connection.host);
  } catch (err) {
    if (retries > 0) {
      console.warn(`[DB] Connection failed. Retrying in ${delayMs / 1000}s... (${retries} attempts left)`);
      await new Promise(res => setTimeout(res, delayMs));
      return connectDB(retries - 1, delayMs);
    }
    console.error('[DB] Could not connect to MongoDB after maximum retries:', err.message);
    throw err;
  }
}

module.exports = connectDB;
