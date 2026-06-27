import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getMyOrders, updateOrderStatus } from '../../api/order.api'
import { toggleAvailability } from '../../api/waiter.api'
import { getPendingPayments, markPaymentReceived } from '../../api/payment.api'
import { useAuthStore } from '../../stores/authStore'
import { useSocket } from '../../hooks/useSocket'
import { useFCM } from '../../hooks/useFCM'
import { Button } from '../../components/Button'
import { OrderStatusBadge } from '../../components/Badge'
import { Spinner } from '../../components/Spinner'

// ── Payment Collect Card ───────────────────────────────────────────────────────

function PaymentCollectCard({ payment, onConfirmed }) {
  const [method,     setMethod]     = useState(payment.method ?? 'cash')
  const [confirming, setConfirming] = useState(false)

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      await markPaymentReceived(payment._id, { method })
      onConfirmed(payment._id)
    } catch {
      setConfirming(false)
    }
  }

  const fmtTime = d => new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="bg-bgCard border border-yellow/30 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-text">Table {payment.tableNumber}</p>
          <p className="text-xs text-textMuted mt-0.5">Requested at {fmtTime(payment.createdAt)}</p>
        </div>
        <p className="text-accent font-bold text-lg">₹{payment.amount}</p>
      </div>
      <select
        value={method}
        onChange={e => setMethod(e.target.value)}
        className="w-full bg-bgElevated border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
      >
        <option value="cash">Cash</option>
        <option value="card">Card</option>
        <option value="upi">UPI</option>
        <option value="gpay">GPay</option>
        <option value="phonepay">PhonePe</option>
      </select>
      <button
        onClick={handleConfirm}
        disabled={confirming}
        className="w-full py-2 bg-green/10 border border-green/40 text-green rounded-xl text-sm font-semibold hover:bg-green/20 disabled:opacity-50 transition-colors"
      >
        {confirming ? 'Confirming…' : 'Mark Payment Collected ✓'}
      </button>
    </div>
  )
}

// ── Reject Reason Modal ────────────────────────────────────────────────────────
function RejectModal({ orderId, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-bgCard border border-border rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-text mb-3">Reject Order</h3>
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for rejection…"
          rows={3}
          data-testid="reject-reason-input"
          className="w-full bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm resize-none focus:outline-none focus:border-accent"
        />
        <div className="flex gap-3 mt-4">
          <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
          <Button fullWidth onClick={() => onConfirm(reason)}>Confirm</Button>
        </div>
      </div>
    </div>
  )
}

// ── Order Card ─────────────────────────────────────────────────────────────────
function OrderCard({ order, onServed, onReject, highlight }) {
  return (
    <div
      data-testid={`order-card-${order._id}`}
      className={[
        'bg-bgCard border rounded-xl p-4 space-y-3 transition-colors',
        highlight ? 'border-green/60 ring-1 ring-green/30' : 'border-border',
      ].join(' ')}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-text">Table {order.tableNumber}</p>
          <p className="text-xs text-textMuted mt-0.5">
            {new Date(order.createdAt).toLocaleTimeString()}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Items */}
      <div className="space-y-1">
        {order.items?.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-text">{item.name} × {item.quantity}</span>
            {item.customizations?.length > 0 && (
              <span className="text-xs text-textMuted">
                {item.customizations.map(c => c.selected).join(', ')}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Notes */}
      {order.items?.some(i => i.specialNote) && (
        <div className="bg-yellow/10 border border-yellow/20 rounded-lg px-3 py-2 text-xs text-yellow">
          📝 {order.items.filter(i => i.specialNote).map(i => i.specialNote).join(' | ')}
        </div>
      )}

      {/* Ready highlight */}
      {highlight && (
        <div data-testid="ready-highlight" className="text-green text-sm font-semibold">
          🚀 Ready for pickup!
        </div>
      )}

      {/* Actions */}
      {['placed', 'assigned', 'preparing', 'ready'].includes(order.status) && (
        <div className="flex gap-2 pt-1">
          <Button
            data-testid={`serve-btn-${order._id}`}
            size="sm"
            fullWidth
            onClick={() => onServed(order._id)}
          >
            Mark Served
          </Button>
          <Button
            data-testid={`reject-btn-${order._id}`}
            variant="danger"
            size="sm"
            fullWidth
            onClick={() => onReject(order._id)}
          >
            Reject
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Main WaiterApp ────────────────────────────────────────────────────────────
export default function WaiterApp() {
  const user     = useAuthStore(s => s.user)
  const navigate = useNavigate()
  useFCM({ enabled: true })

  const [tab,             setTab]             = useState('active')
  const [orders,          setOrders]          = useState([])
  const [loading,         setLoading]         = useState(true)
  const [available,       setAvailable]       = useState(true)
  const [readyOrderIds,   setReadyOrderIds]   = useState(new Set())
  const [rejectTarget,    setRejectTarget]    = useState(null)
  const [pendingPayments, setPendingPayments] = useState([])

  // ── Load orders + pending payments ───────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    try {
      const [orderData, payData] = await Promise.all([getMyOrders(), getPendingPayments()])
      setOrders(orderData.orders ?? [])
      setPendingPayments(payData.payments ?? [])
    } catch {
      // silent — socket will keep data fresh
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOrders()
  }, [loadOrders])

  // ── Socket ───────────────────────────────────────────────────────────────────
  const hotelId = user?.hotelId
  const { on }  = useSocket({ hotelId, role: 'waiter', userId: user?._id })

  useEffect(() => {
    if (!hotelId) return

    on('order:new', ({ order }) => {
      setOrders(prev => {
        if (prev.some(o => o._id === order._id)) return prev
        return [order, ...prev]
      })
    })

    on('order:ready', ({ orderId }) => {
      setReadyOrderIds(prev => new Set([...prev, orderId]))
    })

    on('order:served', ({ orderId }) => {
      setOrders(prev => prev.map(o =>
        o._id === orderId ? { ...o, status: 'served' } : o
      ))
    })

    on('payment:pending', (payment) => {
      setPendingPayments(prev => {
        if (prev.some(p => p._id === payment.paymentId)) return prev
        return [{ _id: payment.paymentId, ...payment }, ...prev]
      })
    })

    on('payment:received', ({ paymentId }) => {
      setPendingPayments(prev => prev.filter(p => p._id !== paymentId))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId])

  // ── Actions ──────────────────────────────────────────────────────────────────
  const handleServed = async (orderId) => {
    try {
      await updateOrderStatus(orderId, 'served')
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status: 'served' } : o))
    } catch {
      // ignore
    }
  }

  const handleReject = (orderId) => setRejectTarget(orderId)

  const confirmReject = async (reason) => {
    if (!rejectTarget) return
    try {
      await updateOrderStatus(rejectTarget, 'rejected', reason)
      setOrders(prev => prev.map(o =>
        o._id === rejectTarget ? { ...o, status: 'rejected' } : o
      ))
    } catch {
      // ignore
    } finally {
      setRejectTarget(null)
    }
  }

  const handleToggleAvailability = async () => {
    const next = !available
    try {
      await toggleAvailability(next)
      setAvailable(next)
    } catch {
      // ignore
    }
  }

  const handlePaymentConfirmed = (paymentId) => {
    setPendingPayments(prev => prev.filter(p => p._id !== paymentId))
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const activeOrders    = orders.filter(o => !['served', 'rejected', 'cancelled'].includes(o.status))
  const completedOrders = orders.filter(o => o.status === 'served')
  const myStats         = user?.stats

  // ── Render ───────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <Spinner size="xl" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-xl text-text">{user?.name}</h1>
          <p className="text-xs text-textMuted">Waiter</p>
        </div>
        {/* Availability toggle */}
        <button
          data-testid="availability-toggle"
          onClick={handleToggleAvailability}
          className={[
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors',
            available
              ? 'bg-green/10 text-green border-green/30'
              : 'bg-red/10 text-red border-red/30',
          ].join(' ')}
        >
          <span className={`w-2 h-2 rounded-full ${available ? 'bg-green' : 'bg-red'}`} />
          {available ? 'Available' : 'Unavailable'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {[
          { key: 'active',    label: `My Orders (${activeOrders.length})` },
          { key: 'payments',  label: `Payments${pendingPayments.length ? ` (${pendingPayments.length})` : ''}` },
          { key: 'completed', label: 'Completed' },
          { key: 'rating',    label: 'My Rating' },
        ].map(t => (
          <button
            key={t.key}
            data-testid={`tab-${t.key}`}
            onClick={() => setTab(t.key)}
            className={[
              'flex-1 py-3 text-sm font-medium transition-colors',
              tab === t.key
                ? 'text-accent border-b-2 border-accent'
                : 'text-textMuted',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Active Orders */}
      {tab === 'active' && (
        <div className="px-4 py-4 space-y-3">
          {activeOrders.length === 0 ? (
            <p className="text-center text-textMuted py-12">No active orders</p>
          ) : (
            activeOrders.map(order => (
              <OrderCard
                key={order._id}
                order={order}
                onServed={handleServed}
                onReject={handleReject}
                highlight={readyOrderIds.has(order._id)}
              />
            ))
          )}
        </div>
      )}

      {/* Pending Payments */}
      {tab === 'payments' && (
        <div className="px-4 py-4 space-y-3">
          {pendingPayments.length === 0 ? (
            <p className="text-center text-textMuted py-12">No pending payments</p>
          ) : (
            pendingPayments.map(p => (
              <PaymentCollectCard key={p._id} payment={p} onConfirmed={handlePaymentConfirmed} />
            ))
          )}
        </div>
      )}

      {/* Completed Orders */}
      {tab === 'completed' && (
        <div className="px-4 py-4 space-y-3">
          {completedOrders.length === 0 ? (
            <p className="text-center text-textMuted py-12">No completed orders today</p>
          ) : (
            completedOrders.map(order => (
              <div key={order._id} className="bg-bgCard border border-border rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-text text-sm font-medium">Table {order.tableNumber}</p>
                  <OrderStatusBadge status={order.status} />
                </div>
                <p className="text-xs text-textMuted mt-1">
                  {order.items?.map(i => `${i.name} ×${i.quantity}`).join(', ')}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {/* My Rating */}
      {tab === 'rating' && (
        <div className="px-4 py-4">
          <div className="bg-bgCard border border-border rounded-xl p-6 text-center">
            <p className="text-5xl font-bold text-accent">
              {myStats?.avgRating?.toFixed(1) ?? '—'}
            </p>
            <p className="text-textMuted text-sm mt-1">Average Rating</p>
            <p className="text-textDim text-xs mt-3">
              {myStats?.ratingCount ?? 0} reviews · {myStats?.totalServed ?? 0} orders served
            </p>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          orderId={rejectTarget}
          onConfirm={confirmReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}
