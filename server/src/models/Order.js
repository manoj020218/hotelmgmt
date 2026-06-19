const mongoose = require('mongoose');

const customizationSelSchema = new mongoose.Schema({
  groupName: { type: String },
  selected:  { type: String },
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  menuItemId:     { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  name:           { type: String, required: true },
  price:          { type: Number, required: true },
  quantity:       { type: Number, required: true, min: 1 },
  customizations: [customizationSelSchema],
  specialNote:    { type: String, default: '' },
  status:         { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
}, { _id: true });

const modificationSchema = new mongoose.Schema({
  type:       { type: String, default: 'add_item' },
  item:       { type: mongoose.Schema.Types.Mixed },
  modifiedAt: { type: Date, default: Date.now },
  modifiedBy: { type: String, default: 'customer' },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  hotelId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  tableId:        { type: mongoose.Schema.Types.ObjectId, ref: 'Table', required: true },
  tableNumber:    { type: Number, required: true },
  sessionId:      { type: String, required: true },
  items:          [orderItemSchema],
  status:         { type: String, enum: ['placed', 'assigned', 'preparing', 'ready', 'served', 'rejected', 'cancelled'], default: 'placed' },
  kdsStatus:      { type: String, enum: ['new', 'accepted', 'preparing', 'ready', 'rejected'], default: 'new' },
  assignedWaiterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedAt:     { type: Date, default: null },
  placedAt:       { type: Date, default: Date.now },
  servedAt:       { type: Date, default: null },
  modifications:  [modificationSchema],
  bill: {
    subtotal:   { type: Number, default: 0 },
    cgst:       { type: Number, default: 0 },
    sgst:       { type: Number, default: 0 },
    total:      { type: Number, default: 0 },
    gstApplied: { type: Boolean, default: false },
  },
  paymentId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  rejectionReason: { type: String, default: '' },
  createdAt:       { type: Date, default: Date.now },
});

// Auto-compute bill.total from subtotal + cgst + sgst
orderSchema.pre('save', function (next) {
  if (this.isModified('bill.subtotal') || this.isModified('bill.cgst') || this.isModified('bill.sgst')) {
    this.bill.total = +(this.bill.subtotal + this.bill.cgst + this.bill.sgst).toFixed(2);
  }
  next();
});

orderSchema.index({ hotelId: 1, status: 1 });
orderSchema.index({ tableId: 1 });
orderSchema.index({ sessionId: 1 });

module.exports = mongoose.model('Order', orderSchema);
