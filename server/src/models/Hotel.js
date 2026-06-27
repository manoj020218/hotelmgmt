const mongoose = require('mongoose');

const hotelSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true },
  logo:       { type: String, default: '' },
  address:    { type: String, default: '' },
  phone:      { type: String, default: '' },
  gstin:      { type: String, default: '' },
  gstEnabled: { type: Boolean, default: false },
  cgstPercent:{ type: Number, default: 9, min: 0, max: 50 },
  sgstPercent:{ type: Number, default: 9, min: 0, max: 50 },
  upiId:      { type: String, default: '' },
  upiQrUrl:   { type: String, default: '' },
  settings: {
    tableVisibilityPublic:    { type: Boolean, default: false },
    kdsEnabled:               { type: Boolean, default: true },
    kitchenOpen:              { type: Boolean, default: true },
    kitchenOpenTime:          { type: String,  default: '10:00' },
    kitchenCloseTime:         { type: String,  default: '23:00' },
    receiptFlow:              { type: String,  enum: ['customer', 'admin', 'both'], default: 'both' },
    autoWaiterAssign:         { type: Boolean, default: true },
    orderModificationWindow:  { type: Number,  default: 5 },
    waiterMode:               { type: String,  enum: ['table', 'manual', 'claim'], default: 'table' },
    orderHistoryDays:         { type: Number,  default: 1, min: 1, max: 7 },
  },
  fcmTopics: {
    admin:   { type: String, default: '' },
    kitchen: { type: String, default: '' },
  },
  createdAt: { type: Date, default: Date.now },
});

hotelSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Hotel', hotelSchema);
