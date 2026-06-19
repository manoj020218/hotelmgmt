const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  hotelId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  targetRole:   { type: String, enum: ['admin', 'waiter', 'kitchen', 'customer'], required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  title:        { type: String, required: true },
  body:         { type: String, required: true },
  data:         { type: mongoose.Schema.Types.Mixed, default: {} },
  read:         { type: Boolean, default: false },
  orderId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  createdAt:    { type: Date, default: Date.now },
});

notificationSchema.index({ hotelId: 1, targetUserId: 1, read: 1 });

module.exports = mongoose.model('Notification', notificationSchema);
