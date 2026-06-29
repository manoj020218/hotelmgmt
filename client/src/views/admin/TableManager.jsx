import { useState, useEffect, useCallback } from 'react'
import QRCode from 'qrcode'
import {
  getAdminTables, createTable, updateTableStatus,
  getTableQR, getTableSession, checkoutTable, getTableHistory,
} from '../../api/table.api'
import { getPendingPayments, markPaymentReceived } from '../../api/payment.api'
import { useAuthStore } from '../../stores/authStore'
import { useSocket } from '../../hooks/useSocket'
import { Spinner } from '../../components/Spinner'
import { generateReceiptCanvas, printCanvas } from '../../utils/receiptCanvas'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function fmtDate(date) {
  return new Date(date).toLocaleDateString([], { day: 'numeric', month: 'short' }) + ' ' + fmt(date)
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  available:    { ring: 'border-green/40   bg-green/5   ', label: 'Available',    dot: 'bg-green'  },
  occupied:     { ring: 'border-accent/50  bg-accent/8  ', label: 'Occupied',     dot: 'bg-accent' },
  bill_pending: { ring: 'border-yellow/50  bg-yellow/8  ', label: 'Bill Pending', dot: 'bg-yellow' },
  reserved:     { ring: 'border-blue/40    bg-blue/5    ', label: 'Reserved',     dot: 'bg-blue'   },
  blocked:      { ring: 'border-red/40     bg-red/5     ', label: 'Blocked',      dot: 'bg-red'    },
}

// ── QR Modal ──────────────────────────────────────────────────────────────────

function QRModal({ tableNumber, dataUrl, onClose }) {
  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `table-${tableNumber}-qr.png`
    a.click()
  }
  const handlePrint = () => {
    const w = window.open('', '_blank', 'width=400,height=500')
    w.document.write(`<!DOCTYPE html><html><head><title>Table ${tableNumber} QR</title>
      <style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff}
      img{max-width:300px}</style></head>
      <body><img src="${dataUrl}" onload="window.print();window.close()"/></body></html>`)
    w.document.close()
  }
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-bgCard border border-border rounded-2xl p-5 flex flex-col items-center gap-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
        <p className="font-semibold text-text">QR Code — Table {tableNumber}</p>
        <img src={dataUrl} alt={`QR for table ${tableNumber}`} className="rounded-xl border border-border" style={{ width: 240 }} />
        <div className="flex gap-2 w-full">
          <button onClick={onClose}   className="flex-1 px-3 py-1.5 bg-bgElevated border border-border rounded-lg text-xs text-textMuted hover:text-text transition-colors">Close</button>
          <button onClick={handleDownload} className="flex-1 px-3 py-1.5 bg-bgElevated border border-border rounded-lg text-xs text-textMuted hover:text-text transition-colors">Download</button>
          <button onClick={handlePrint}    className="flex-1 px-3 py-1.5 bg-accent text-bg rounded-lg text-xs font-semibold">Print</button>
        </div>
      </div>
    </div>
  )
}

// ── Session Modal (current visit detail) ─────────────────────────────────────

function SessionModal({ table, onClose, onCheckedOut, onShowHistory, hotelName }) {
  const [orders,       setOrders]       = useState([])
  const [total,        setTotal]        = useState(table.sessionBillTotal ?? 0)
  const [loading,      setLoading]      = useState(true)
  const [checking,     setChecking]     = useState(false)
  const [pendingPays,  setPendingPays]  = useState([])
  const [payMethod,    setPayMethod]    = useState('cash')
  const [confirming,   setConfirming]   = useState(false)

  useEffect(() => {
    Promise.all([getTableSession(table._id), getPendingPayments()])
      .then(([session, paysData]) => {
        setOrders(session.orders ?? [])
        setTotal(session.sessionBillTotal ?? 0)
        const myPays = (paysData.payments ?? []).filter(
          p => p.tableNumber === table.tableNumber
        )
        setPendingPays(myPays)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [table._id, table.tableNumber])

  const handleCheckout = async () => {
    setChecking(true)
    try {
      const data = await checkoutTable(table._id)
      onCheckedOut(data.table)
      onClose()
    } catch {
      setChecking(false)
    }
  }

  const handleConfirmPayment = async (paymentId) => {
    setConfirming(true)
    try {
      await markPaymentReceived(paymentId, { method: payMethod })
      setPendingPays(prev => prev.filter(p => p._id !== paymentId))
    } catch {}
    finally { setConfirming(false) }
  }

  const handlePrint = () => {
    const allItems = orders.flatMap(o => o.items ?? [])
    const canvas = generateReceiptCanvas({
      hotelName,
      tableNumber:     table.tableNumber,
      items:           allItems,
      bill:            { total, subtotal: total },
      sessionBillTotal: total,
      timestamp:       new Date(),
    })
    printCanvas(canvas)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-bgCard border border-border rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="font-bold text-text text-lg">Table {table.tableNumber}</p>
            <p className="text-xs text-textMuted capitalize">{STATUS_CFG[table.status]?.label ?? table.status}</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-text text-xl leading-none">×</button>
        </div>

        {/* Orders list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : orders.length === 0 ? (
            <p className="text-textMuted text-sm text-center py-8">No orders in current session</p>
          ) : (
            orders.map((order, idx) => (
              <div key={order._id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-textMuted">Order {idx + 1}</span>
                  <span className="text-xs text-textDim">— {fmtDate(order.createdAt)}</span>
                  <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full ${
                    order.status === 'served' ? 'bg-green/10 text-green' : 'bg-accent/10 text-accent'
                  }`}>{order.status}</span>
                </div>
                {order.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-text">{item.name} <span className="text-textMuted">×{item.quantity}</span></span>
                    <span className="text-textMuted">₹{(item.price * item.quantity).toFixed(0)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs text-textMuted border-t border-border/50 pt-1 mt-1">
                  <span>Subtotal</span>
                  <span>₹{order.bill?.subtotal?.toFixed(0) ?? '—'}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total + actions */}
        {!loading && (
          <div className="px-5 py-4 border-t border-border space-y-3">
            <div className="flex justify-between font-bold text-text">
              <span>Total Bill</span>
              <span className="text-accent text-lg">₹{total.toFixed(0)}</span>
            </div>

            {/* Pending payment confirmation */}
            {pendingPays.length > 0 && (
              <div className="bg-yellow/10 border border-yellow/30 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-yellow">
                  Payment Requested — ₹{pendingPays[0].amount} ({pendingPays[0].method})
                </p>
                <div className="flex gap-2">
                  <select
                    value={payMethod}
                    onChange={e => setPayMethod(e.target.value)}
                    className="flex-1 bg-bgElevated border border-border rounded-lg px-2 py-1.5 text-text text-xs focus:outline-none"
                  >
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="gpay">GPay</option>
                    <option value="phonepay">PhonePe</option>
                  </select>
                  <button
                    onClick={() => handleConfirmPayment(pendingPays[0]._id)}
                    disabled={confirming}
                    className="px-3 py-1.5 bg-green/10 border border-green/40 text-green rounded-lg text-xs font-semibold disabled:opacity-50"
                  >
                    {confirming ? '…' : 'Confirm Collected'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="px-3 py-2 bg-bgElevated border border-border rounded-xl text-xs text-textMuted hover:text-text transition-colors"
                title="Print thermal receipt"
              >
                Print
              </button>
              <button
                onClick={() => { onClose(); onShowHistory(table) }}
                className="flex-1 px-3 py-2 bg-bgElevated border border-border rounded-xl text-xs text-textMuted hover:text-text transition-colors"
              >
                Order History
              </button>
              <button
                onClick={handleCheckout}
                disabled={checking}
                className="flex-1 px-3 py-2 bg-green/10 border border-green/40 text-green rounded-xl text-xs font-semibold hover:bg-green/20 disabled:opacity-50 transition-colors"
              >
                {checking ? 'Processing…' : 'Customer Done — Free Table'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── History Modal ─────────────────────────────────────────────────────────────

function HistoryModal({ table, onClose, hotelName }) {
  const [orders,  setOrders]  = useState([])
  const [days,    setDays]    = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTableHistory(table._id)
      .then(d => { setOrders(d.orders ?? []); setDays(d.days ?? 1) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [table._id])

  const handlePrintOrder = (order) => {
    const canvas = generateReceiptCanvas({
      hotelName,
      tableNumber: table.tableNumber,
      items: order.items ?? [],
      bill: order.bill ?? {},
      timestamp: order.createdAt,
    })
    printCanvas(canvas)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-bgCard border border-border rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <p className="font-bold text-text text-lg">Table {table.tableNumber} — History</p>
            <p className="text-xs text-textMuted">Last {days} day{days > 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-textMuted hover:text-text text-xl leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : orders.length === 0 ? (
            <p className="text-textMuted text-sm text-center py-8">No orders in the last {days} day{days > 1 ? 's' : ''}</p>
          ) : (
            orders.map(order => (
              <div key={order._id} className="bg-bgElevated rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-textMuted">{fmtDate(order.createdAt)}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    order.status === 'served' ? 'bg-green/10 text-green' : 'bg-textDim/10 text-textDim'
                  }`}>{order.status}</span>
                </div>
                {order.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-text">{item.name} <span className="text-textMuted">×{item.quantity}</span></span>
                    <span className="text-textMuted">₹{(item.price * item.quantity).toFixed(0)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-xs font-semibold text-text border-t border-border/50 pt-1">
                  <span>Order Total</span>
                  <div className="flex items-center gap-2">
                    <span>₹{order.bill?.total?.toFixed(0) ?? '—'}</span>
                    <button
                      onClick={() => handlePrintOrder(order)}
                      className="text-xs text-textMuted hover:text-accent underline"
                    >
                      Print
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Table Card ────────────────────────────────────────────────────────────────

function TableCard({ table, onStatusChange, onShowQR, onShowSession, qrLoading }) {
  const cfg = STATUS_CFG[table.status] ?? STATUS_CFG.available
  const isActive = ['occupied', 'bill_pending'].includes(table.status)

  return (
    <div
      data-testid={`table-card-${table._id}`}
      className={`border-2 rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.02] ${cfg.ring}`}
      onClick={() => isActive && onShowSession(table)}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-1">
        <p className="font-bold text-text text-base leading-tight">T{table.tableNumber}</p>
        <span className={`w-2 h-2 rounded-full mt-1 shrink-0 ${cfg.dot}`} />
      </div>

      {/* Status label */}
      <p className="text-xs text-textMuted mb-1">{cfg.label}</p>

      {/* Assigned waiter */}
      {table.assignedWaiterId?.name && (
        <p className="text-xs text-blue truncate mb-1">
          {table.assignedWaiterId.name}
        </p>
      )}

      {/* Bill amount when bill_pending */}
      {table.status === 'bill_pending' && (
        <p className="text-sm font-bold text-yellow mb-1">
          ₹{(table.sessionBillTotal ?? 0).toFixed(0)}
        </p>
      )}

      {/* New Order pulse */}
      {table.hasNewOrder && (
        <div className="flex items-center gap-1 mb-1">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-semibold text-accent">New Order</span>
        </div>
      )}

      {/* Tap to view hint */}
      {isActive && (
        <p className="text-xs text-textDim mb-1">Tap to view</p>
      )}

      {/* Bottom controls */}
      <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
        <select
          data-testid={`status-select-${table._id}`}
          value={table.status}
          onChange={e => onStatusChange(table._id, e.target.value)}
          className="flex-1 bg-bgElevated border border-border rounded-lg px-1.5 py-1 text-text text-xs focus:outline-none min-w-0"
        >
          {['available', 'occupied', 'reserved', 'blocked'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
          {table.status === 'bill_pending' && (
            <option value="bill_pending" disabled>bill_pending</option>
          )}
        </select>
        <button
          type="button"
          data-testid={`qr-btn-${table._id}`}
          onClick={() => onShowQR(table._id, table.tableNumber)}
          disabled={qrLoading === table._id}
          className="px-2 py-1 text-xs bg-bgElevated border border-border rounded-lg text-textMuted hover:text-text disabled:opacity-50 shrink-0"
        >
          {qrLoading === table._id ? '…' : 'QR'}
        </button>
      </div>

      {table.notes?.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {table.notes.map((n, i) => (
            <p key={i} className="text-xs text-yellow truncate">{n.tag && `[${n.tag}] `}{n.text}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function TableManager() {
  const [tables,    setTables]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [newNum,    setNewNum]     = useState('')
  const [newCap,    setNewCap]     = useState('4')
  const [adding,    setAdding]     = useState(false)
  const [qrLoading, setQrLoading] = useState(null)
  const [qrModal,   setQrModal]   = useState(null)       // { dataUrl, tableNumber }
  const [sessionModal, setSessionModal] = useState(null) // table object
  const [historyModal, setHistoryModal] = useState(null) // table object

  const hotelId  = useAuthStore(s => s.user?.hotelId)
  const user     = useAuthStore(s => s.user)
  const hotelName = useAuthStore(s => s.user?.hotelName ?? s.hotel?.name ?? '')

  const load = useCallback(() => {
    getAdminTables()
      .then(data => setTables(data.tables ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  // Real-time table status updates
  const { on } = useSocket({ hotelId, role: 'admin', userId: user?._id })
  useEffect(() => {
    if (!hotelId) return
    on('table:status', ({ tableId, status, hasNewOrder, sessionBillTotal, assignedWaiterName }) => {
      setTables(prev => prev.map(t => {
        if (t._id?.toString() !== tableId?.toString()) return t
        const updated = {
          ...t,
          status,
          hasNewOrder:      hasNewOrder      ?? t.hasNewOrder,
          sessionBillTotal: sessionBillTotal ?? t.sessionBillTotal,
        }
        // Update waiter name if included in the event payload
        if (assignedWaiterName !== undefined) {
          updated.assignedWaiterId = assignedWaiterName
            ? { ...(t.assignedWaiterId ?? {}), name: assignedWaiterName }
            : null
        }
        return updated
      }))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId])

  const handleStatusChange = async (tableId, status) => {
    try {
      const data = await updateTableStatus(tableId, { status })
      setTables(prev => prev.map(t => t._id === tableId ? data.table : t))
    } catch {}
  }

  const handleShowQR = async (tableId, tableNumber) => {
    setQrLoading(tableId)
    try {
      const data    = await getTableQR(tableId)
      const token   = data.qrToken
      if (!token) return
      const content = `${window.location.origin}/menu?hotel=${hotelId}&table=${token}`
      const qrPx = 260, pad = 16, labelH = 72
      const W = qrPx + pad * 2, H = qrPx + pad * 2 + labelH
      const composite = document.createElement('canvas')
      composite.width = W; composite.height = H
      const ctx = composite.getContext('2d')
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H)
      const qrCanvas = document.createElement('canvas')
      await QRCode.toCanvas(qrCanvas, content, { width: qrPx, margin: 1, color: { dark: '#000000', light: '#ffffff' } })
      ctx.drawImage(qrCanvas, pad, pad)
      ctx.strokeStyle = '#dddddd'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(pad, qrPx + pad + 4); ctx.lineTo(W - pad, qrPx + pad + 4); ctx.stroke()
      ctx.fillStyle = '#111111'; ctx.font = 'bold 22px sans-serif'; ctx.textAlign = 'center'
      ctx.fillText(`Table ${tableNumber}`, W / 2, qrPx + pad + 30)
      ctx.fillStyle = '#666666'; ctx.font = '13px sans-serif'
      ctx.fillText('Scan to order', W / 2, qrPx + pad + 52)
      setQrModal({ dataUrl: composite.toDataURL('image/png'), tableNumber })
    } catch (err) { console.error('[QR]', err) }
    finally { setQrLoading(null) }
  }

  const handleCheckedOut = (updatedTable) => {
    setTables(prev => prev.map(t => t._id === updatedTable._id ? { ...t, ...updatedTable } : t))
  }

  const handleAddTable = async () => {
    if (!newNum) return
    setAdding(true)
    try {
      const data = await createTable({ tableNumber: Number(newNum), capacity: Number(newCap) })
      setTables(prev => [...prev, data.table])
      setNewNum('')
    } catch {}
    finally { setAdding(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><Spinner size="xl" /></div>

  // Summary counts
  const counts = tables.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="p-4">
      <h2 className="font-display font-bold text-xl text-text mb-1">Tables</h2>

      {/* Status summary bar */}
      <div className="flex gap-3 mb-4 text-xs flex-wrap">
        {Object.entries(STATUS_CFG).map(([key, cfg]) =>
          counts[key] ? (
            <span key={key} className="flex items-center gap-1 text-textMuted">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {counts[key]} {cfg.label}
            </span>
          ) : null
        )}
      </div>

      {/* Add table */}
      <div className="bg-bgCard border border-border rounded-xl p-4 mb-4 flex gap-3 items-end">
        <div className="flex-1">
          <p className="text-xs text-textMuted mb-1">Table Number</p>
          <input type="number" value={newNum} onChange={e => setNewNum(e.target.value)}
            placeholder="e.g. 13" data-testid="new-table-num"
            className="w-full bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex-1">
          <p className="text-xs text-textMuted mb-1">Capacity</p>
          <input type="number" value={newCap} onChange={e => setNewCap(e.target.value)}
            className="w-full bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <button data-testid="add-table-btn" disabled={adding} onClick={handleAddTable}
          className="px-4 py-2 bg-accent text-bg rounded-xl text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">
          Add
        </button>
      </div>

      {/* Table grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {tables.map(table => (
          <TableCard
            key={table._id}
            table={table}
            onStatusChange={handleStatusChange}
            onShowQR={handleShowQR}
            onShowSession={setSessionModal}
            qrLoading={qrLoading}
          />
        ))}
      </div>

      {qrModal && (
        <QRModal tableNumber={qrModal.tableNumber} dataUrl={qrModal.dataUrl} onClose={() => setQrModal(null)} />
      )}

      {sessionModal && (
        <SessionModal
          table={sessionModal}
          hotelName={hotelName}
          onClose={() => setSessionModal(null)}
          onCheckedOut={handleCheckedOut}
          onShowHistory={t => { setSessionModal(null); setHistoryModal(t) }}
        />
      )}

      {historyModal && (
        <HistoryModal table={historyModal} hotelName={hotelName} onClose={() => setHistoryModal(null)} />
      )}
    </div>
  )
}
