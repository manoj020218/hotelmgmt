const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  text:    { type: String, required: true },
  tag:     { type: String, default: '' },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  addedAt: { type: Date, default: Date.now },
}, { _id: true });

const tableSchema = new mongoose.Schema({
  hotelId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  tableNumber:   { type: Number, required: true },
  capacity:      { type: Number, required: true, min: 1 },
  status:        { type: String, enum: ['available', 'occupied', 'reserved', 'blocked'], default: 'available' },
  currentOrderId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
  notes:         [noteSchema],
  qrCodeUrl:     { type: String, default: '' },
  qrToken:       { type: String, default: '' },
  reservedFor:   { type: String, default: '' },
  reservedAt:    { type: Date, default: null },
  createdAt:     { type: Date, default: Date.now },
});

tableSchema.index({ hotelId: 1, tableNumber: 1 }, { unique: true });
tableSchema.index({ qrToken: 1 });

module.exports = mongoose.model('Table', tableSchema);
