const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  hotelId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  orderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  tableNumber: { type: Number, required: true },
  amount:      { type: Number, required: true, min: 0 },
  method:      { type: String, enum: ['upi', 'gpay', 'phonepay', 'cash', 'card'], default: 'cash' },
  status:      { type: String, enum: ['pending', 'received', 'disputed'], default: 'pending' },
  upiRef:      { type: String, default: '' },
  receivedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  receivedAt:  { type: Date, default: null },
  receiptUrl:  { type: String, default: '' },
  createdAt:   { type: Date, default: Date.now },
});

paymentSchema.index({ hotelId: 1, status: 1 });
paymentSchema.index({ orderId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
