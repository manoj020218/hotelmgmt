const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  hotelId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  name:         { type: String, required: true, trim: true },
  email:        { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  phone:        { type: String, default: '' },
  passwordHash: { type: String, default: '' },
  role:         { type: String, enum: ['admin', 'waiter', 'kitchen'], required: true },
  pin:          { type: String, default: '' },
  available:       { type: Boolean, default: true },
  manuallyOffline: { type: Boolean, default: false },
  activeOrderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Order' }],
  fcmToken:     { type: String, default: '' },
  avatar:       { type: String, default: '' },
  refreshToken: { type: String, default: '' },
  stats: {
    totalServed:   { type: Number, default: 0 },
    totalRejected: { type: Number, default: 0 },
    avgRating:     { type: Number, default: 0 },
    ratingCount:   { type: Number, default: 0 },
  },
  isActive:  { type: Boolean, default: true },
  lastSeen:  { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

userSchema.index({ hotelId: 1, role: 1 });

// Hash passwordHash and pin before saving if modified and not yet hashed
userSchema.pre('save', async function (next) {
  if (this.isModified('passwordHash') && this.passwordHash && !this.passwordHash.startsWith('$2')) {
    this.passwordHash = await bcrypt.hash(this.passwordHash, 12);
  }
  if (this.isModified('pin') && this.pin && !this.pin.startsWith('$2')) {
    this.pin = await bcrypt.hash(this.pin, 12);
  }
  next();
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.methods.comparePin = function (plain) {
  return bcrypt.compare(plain, this.pin);
};

module.exports = mongoose.model('User', userSchema);
