const mongoose = require('mongoose');

const deleteCodeSchema = new mongoose.Schema({
  hotelId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Hotel', required: true },
  code:      { type: String, required: true },
  expiresAt: { type: Date,   required: true },
  usedAt:    { type: Date,   default: null },
});

deleteCodeSchema.index({ hotelId: 1, code: 1 });
deleteCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // auto-purge expired

module.exports = mongoose.model('DeleteCode', deleteCodeSchema);
