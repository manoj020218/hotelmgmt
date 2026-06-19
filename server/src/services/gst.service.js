function calculateBill(items, hotel) {
  const roundTo2 = (n) => Math.round(n * 100) / 100;

  const subtotal = roundTo2(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

  let cgst = 0;
  let sgst = 0;
  if (hotel.gstEnabled) {
    cgst = roundTo2(subtotal * hotel.cgstPercent / 100);
    sgst = roundTo2(subtotal * hotel.sgstPercent / 100);
  }

  const total = roundTo2(subtotal + cgst + sgst);
  return { subtotal, cgst, sgst, total, gstApplied: hotel.gstEnabled };
}

module.exports = { calculateBill };
