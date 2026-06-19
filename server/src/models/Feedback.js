const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  hotelId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  orderId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
  tableId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Table' },
  waiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  ratings: {
    waiter:  { type: Number, min: 1, max: 5 },
    food:    { type: Number, min: 1, max: 5 },
    overall: { type: Number, min: 1, max: 5, required: true },
  },
  comment:     { type: String, default: '' },
  submittedAt: { type: Date, default: Date.now },
});

feedbackSchema.index({ hotelId: 1, submittedAt: -1 });
feedbackSchema.index({ waiterId: 1 });

module.exports = mongoose.model('Feedback', feedbackSchema);
