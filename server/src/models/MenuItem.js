const mongoose = require('mongoose');

const customizationSchema = new mongoose.Schema({
  groupName: { type: String, required: true },
  type:      { type: String, enum: ['single', 'multi'], default: 'single' },
  required:  { type: Boolean, default: false },
  choices:   [{ type: String }],
}, { _id: false });

const menuItemSchema = new mongoose.Schema({
  hotelId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category:    { type: String, required: true, trim: true },
  price:       { type: Number, required: true, min: 0 },
  halfPrice:   { type: Number, default: null },
  fullPrice:   { type: Number, default: null },
  photoUrl:    { type: String, default: '' },
  available:   { type: Boolean, default: true },
  isVeg:       { type: Boolean, default: true },
  customizationOptions: [customizationSchema],
  tags:        [{ type: String }],
  stats: {
    totalOrders: { type: Number, default: 0 },
    avgRating:   { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  sortOrder: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

menuItemSchema.index({ hotelId: 1, category: 1 });
menuItemSchema.index({ hotelId: 1, available: 1 });

module.exports = mongoose.model('MenuItem', menuItemSchema);
