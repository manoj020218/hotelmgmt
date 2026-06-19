const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');
const { getPublicUrl } = require('../config/storage');

async function generateReceipt(order, hotel, payment) {
  const base        = process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads');
  const receiptsDir = path.join(base, 'receipts');

  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }

  const filename = `${order._id}.pdf`;
  const filepath = path.join(receiptsDir, filename);

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50, size: 'A5' });
    const stream = fs.createWriteStream(filepath);

    doc.pipe(stream);

    // ── Header ────────────────────────────────────────────────────────────────
    doc.fontSize(16).font('Helvetica-Bold').text(hotel.name, { align: 'center' });
    if (hotel.address) {
      doc.fontSize(9).font('Helvetica').text(hotel.address, { align: 'center' });
    }
    if (hotel.gstin) {
      doc.text(`GSTIN: ${hotel.gstin}`, { align: 'center' });
    }

    doc.moveDown(0.5);
    doc.fontSize(9).text('─'.repeat(55));

    // ── Order info ────────────────────────────────────────────────────────────
    const d = new Date(order.placedAt || Date.now());
    const dateStr = d.toLocaleDateString('en-IN');
    const timeStr = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    doc.text(`Table: ${order.tableNumber}          Date: ${dateStr}`);
    doc.text(`Order: ${String(order._id).slice(-8).toUpperCase()}    Time: ${timeStr}`);

    doc.text('─'.repeat(55));

    // ── Items ─────────────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').text('Item                                 Qty    Amount');
    doc.font('Helvetica');

    order.items.forEach(item => {
      const name   = (item.name || '').substring(0, 32).padEnd(32);
      const qty    = String(item.quantity).padStart(3);
      const amount = `₹${(item.price * item.quantity).toFixed(0)}`;
      doc.text(`${name}  ${qty}    ${amount}`);
    });

    doc.text('─'.repeat(55));

    // ── Bill ──────────────────────────────────────────────────────────────────
    doc.text(`Subtotal${' '.repeat(40)}₹${order.bill.subtotal}`);

    if (hotel.gstEnabled) {
      doc.text(`CGST (${hotel.cgstPercent}%)${' '.repeat(38)}₹${order.bill.cgst}`);
      doc.text(`SGST (${hotel.sgstPercent}%)${' '.repeat(38)}₹${order.bill.sgst}`);
    }

    doc.text('─'.repeat(55));
    doc.font('Helvetica-Bold')
      .fontSize(11)
      .text(`TOTAL${' '.repeat(43)}₹${order.bill.total}`);
    doc.font('Helvetica').fontSize(9);
    doc.text('─'.repeat(55));

    // ── Footer ────────────────────────────────────────────────────────────────
    if (payment && payment.method) {
      doc.text(`Paid via: ${payment.method.toUpperCase()}`);
    }
    doc.moveDown(0.5);
    doc.text('Thank you for dining with us!', { align: 'center' });
    doc.text('Please rate your experience.', { align: 'center' });

    doc.end();

    stream.on('finish', () => resolve(getPublicUrl('receipts', filename)));
    stream.on('error', reject);
  });
}

module.exports = { generateReceipt };
