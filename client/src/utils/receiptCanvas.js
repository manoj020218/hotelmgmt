// Generates a 58mm thermal-printer-style receipt as a Canvas element.
const W = 320  // CSS pixels (≈58mm at screen density)

function line(ctx, y) {
  ctx.beginPath()
  ctx.moveTo(12, y)
  ctx.lineTo(W - 12, y)
  ctx.strokeStyle = '#000'
  ctx.lineWidth = 0.5
  ctx.stroke()
}

function text(ctx, str, x, y, opts = {}) {
  ctx.font = opts.bold ? `bold ${opts.size ?? 12}px 'Courier New', monospace` : `${opts.size ?? 12}px 'Courier New', monospace`
  ctx.fillStyle = '#000'
  ctx.textAlign  = opts.align ?? 'left'
  ctx.fillText(str, x, y)
}

export function generateReceiptCanvas({ hotelName, tableNumber, items = [], bill = {}, timestamp, sessionBillTotal }) {
  const PAD   = 14
  const LH    = 20

  // Estimate height
  const rows = items.length
  const hasGst = bill.gstApplied
  const estimatedLines = 18 + rows + (hasGst ? 3 : 0)
  const H = estimatedLines * LH + 40

  const canvas = document.createElement('canvas')
  canvas.width  = W * 2
  canvas.height = H * 2
  canvas.style.width  = `${W}px`
  canvas.style.height = `${H}px`

  const ctx = canvas.getContext('2d')
  ctx.scale(2, 2)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, W, H)

  let y = 24

  // Hotel name
  text(ctx, (hotelName || 'Hotel').toUpperCase(), W / 2, y, { bold: true, size: 14, align: 'center' }); y += LH
  text(ctx, 'BILL RECEIPT', W / 2, y, { size: 11, align: 'center' }); y += LH

  line(ctx, y); y += LH - 6

  // Table + date
  const dateStr = new Date(timestamp || Date.now()).toLocaleString('en-IN', { hour12: true })
  text(ctx, `Table: ${tableNumber}`, PAD, y, { size: 11 })
  text(ctx, dateStr, W - PAD, y, { size: 11, align: 'right' }); y += LH

  line(ctx, y); y += LH - 6

  // Column headers
  text(ctx, 'Item', PAD, y, { bold: true, size: 11 })
  text(ctx, 'Qty', 210, y, { bold: true, size: 11, align: 'center' })
  text(ctx, 'Amount', W - PAD, y, { bold: true, size: 11, align: 'right' }); y += LH - 2

  line(ctx, y); y += LH - 6

  // Items
  for (const item of items) {
    const name = item.name?.length > 20 ? item.name.slice(0, 20) + '..' : (item.name || '')
    text(ctx, name,                      PAD,     y, { size: 11 })
    text(ctx, `x${item.quantity ?? 1}`, 210,     y, { size: 11, align: 'center' })
    text(ctx, `${((item.price ?? 0) * (item.quantity ?? 1)).toFixed(0)}`, W - PAD, y, { size: 11, align: 'right' }); y += LH
  }

  line(ctx, y); y += LH - 6

  // Subtotal
  text(ctx, 'Subtotal',  PAD, y, { size: 11 })
  text(ctx, `${bill.subtotal?.toFixed(0) ?? '—'}`, W - PAD, y, { size: 11, align: 'right' }); y += LH

  if (hasGst) {
    text(ctx, `CGST (${bill.cgstPercent ?? ''}%)`, PAD, y, { size: 11 })
    text(ctx, `${bill.cgst?.toFixed(0)}`, W - PAD, y, { size: 11, align: 'right' }); y += LH
    text(ctx, `SGST (${bill.sgstPercent ?? ''}%)`, PAD, y, { size: 11 })
    text(ctx, `${bill.sgst?.toFixed(0)}`, W - PAD, y, { size: 11, align: 'right' }); y += LH
  }

  line(ctx, y); y += LH - 6

  // Total
  text(ctx, 'TOTAL', PAD, y, { bold: true, size: 13 })
  text(ctx, `₹${(bill.total ?? sessionBillTotal ?? 0).toFixed(0)}`, W - PAD, y, { bold: true, size: 13, align: 'right' }); y += LH + 4

  line(ctx, y); y += LH

  // Footer
  text(ctx, 'Thank You! Visit Again', W / 2, y, { bold: true, size: 12, align: 'center' }); y += LH + 4
  text(ctx, 'Powered by HotelQR', W / 2, y, { size: 10, align: 'center' })

  return canvas
}

export async function downloadReceipt(canvas, filename = 'receipt.png') {
  return new Promise(resolve => {
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      resolve()
    }, 'image/png')
  })
}

export async function shareReceipt(canvas, tableNumber) {
  if (!navigator.share || !navigator.canShare) {
    await downloadReceipt(canvas, `receipt-table${tableNumber}.png`)
    return
  }
  return new Promise(resolve => {
    canvas.toBlob(async blob => {
      const file = new File([blob], `receipt-table${tableNumber}.png`, { type: 'image/png' })
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ title: `Table ${tableNumber} Bill`, files: [file] })
        } catch { /* user cancelled */ }
      } else {
        await downloadReceipt(canvas, `receipt-table${tableNumber}.png`)
      }
      resolve()
    }, 'image/png')
  })
}

export function printCanvas(canvas) {
  const img = canvas.toDataURL('image/png')
  const w = window.open('', '_blank', 'width=320,height=600')
  if (!w) { alert('Please allow popups to print'); return }
  w.document.write(`<!DOCTYPE html><html>
    <head><title>Receipt</title>
    <style>
      @page { size: 58mm auto; margin: 0; }
      body  { margin: 0; background: #fff; }
      img   { width: 58mm; display: block; }
    </style></head>
    <body><img src="${img}" onload="window.print();window.close()"/></body>
    </html>`)
  w.document.close()
}
