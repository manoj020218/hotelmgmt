import React, { useState, useEffect } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { getOrder, modifyOrder } from '../../api/order.api'
import { getMenu } from '../../api/menu.api'
import { useSocket } from '../../hooks/useSocket'
import { Button } from '../../components/Button'
import { Badge, OrderStatusBadge } from '../../components/Badge'
import { Spinner } from '../../components/Spinner'

// ── Status steps ──────────────────────────────────────────────────────────────
const STEPS = [
  { key: 'placed',    label: 'Placed'    },
  { key: 'assigned',  label: 'Assigned'  },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready',     label: 'Ready'     },
  { key: 'served',    label: 'Served'    },
]

function stepIndex(status) {
  const idx = STEPS.findIndex(s => s.key === status)
  return idx >= 0 ? idx : 0
}

function ProgressTracker({ status }) {
  const current = stepIndex(status)
  const isRejected = status === 'rejected' || status === 'cancelled'

  if (isRejected) {
    return (
      <div className="flex items-center justify-center gap-2 py-4" data-testid="progress-rejected">
        <span className="text-2xl">❌</span>
        <span className="text-red font-semibold">Order {status}</span>
      </div>
    )
  }

  return (
    <div data-testid="progress-tracker" className="px-4 py-4">
      <div className="flex items-center">
        {STEPS.map((step, idx) => (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                  idx <= current
                    ? 'bg-accent text-bg'
                    : 'bg-bgElevated text-textDim border border-border',
                ].join(' ')}
              >
                {idx < current ? '✓' : idx + 1}
              </div>
              <span className={`text-[10px] mt-1 text-center ${idx <= current ? 'text-text' : 'text-textDim'}`}>
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mb-4 ${idx < current ? 'bg-accent' : 'bg-border'}`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function OrderStatusPage() {
  const { orderId }  = useParams()
  const location     = useLocation()
  const navigate     = useNavigate()
  const sessionId    = location.state?.sessionId
    ?? JSON.parse(sessionStorage.getItem('lastOrder') ?? '{}').sessionId

  const [order,       setOrder]       = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [waiterName,  setWaiterName]  = useState(null)
  const [rejected,    setRejected]    = useState({ flag: false, reason: '' })

  // Fetch initial order
  useEffect(() => {
    if (!orderId) return
    getOrder(orderId)
      .then(data => setOrder(data.order))
      .catch(err => setError(err.response?.data?.error ?? 'Could not load order'))
      .finally(() => setLoading(false))
  }, [orderId])

  // Socket subscriptions — register once when orderId is known
  const { on } = useSocket({ hotelId: order?.hotelId, orderId })

  useEffect(() => {
    if (!orderId) return
    // Handlers use functional state updates so they never close over stale values
    on('order:assigned', (payload) => {
      const wn  = payload?.waiterName
      const wid = payload?.waiterId
      if (wn) setWaiterName(wn)
      setOrder(prev => prev ? { ...prev, status: 'assigned', assignedWaiterId: wid } : prev)
    })
    on('order:kds_accepted', () =>
      setOrder(prev => prev ? { ...prev, status: 'preparing', kdsStatus: 'accepted' } : prev)
    )
    on('order:kds_rejected', ({ reason } = {}) => {
      setRejected({ flag: true, reason: reason ?? '' })
      setOrder(prev => prev ? { ...prev, status: 'rejected', kdsStatus: 'rejected' } : prev)
    })
    on('order:ready', () =>
      setOrder(prev => prev ? { ...prev, status: 'ready', kdsStatus: 'ready' } : prev)
    )
    on('order:served', () =>
      setOrder(prev => prev ? { ...prev, status: 'served' } : prev)
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <Spinner size="xl" />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg gap-4 px-4">
        <span className="text-4xl">⚠️</span>
        <p className="text-text">{error || 'Order not found'}</p>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </div>
    )
  }

  const canModify = ['placed', 'assigned'].includes(order.status) && !rejected.flag
  const isPaid    = order.status === 'served'

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur-md border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-display font-bold text-xl text-text">Order Status</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="text-xs text-textMuted mt-0.5">Table {order.tableNumber}</p>
      </div>

      {/* Progress tracker */}
      <ProgressTracker status={order.status} />

      {/* Rejection notice */}
      {rejected.flag && (
        <div
          data-testid="rejection-notice"
          className="mx-4 mb-3 bg-red/10 border border-red/20 rounded-xl px-4 py-3"
        >
          <p className="text-red font-semibold text-sm">Order rejected by kitchen</p>
          {rejected.reason && (
            <p className="text-red/80 text-xs mt-0.5">{rejected.reason}</p>
          )}
        </div>
      )}

      {/* Waiter assignment card */}
      {waiterName && order.status !== 'rejected' && (
        <div
          data-testid="waiter-assignment"
          className="mx-4 mb-3 bg-green/10 border border-green/20 rounded-xl px-4 py-3"
        >
          <p className="text-green text-sm font-semibold">Waiter assigned</p>
          <p className="text-text text-sm mt-0.5"><span className="font-semibold">{waiterName}</span> will be with you shortly</p>
        </div>
      )}

      {/* Ready notice */}
      {order.status === 'ready' && (
        <div
          data-testid="ready-notice"
          className="mx-4 mb-3 bg-accent/10 border border-accent/20 rounded-xl px-4 py-3 text-center"
        >
          <p className="text-accent font-semibold">🚀 Coming to you!</p>
          <p className="text-textMuted text-xs mt-0.5">Your food is ready and on its way</p>
        </div>
      )}

      {/* Order items */}
      <div className="mx-4 bg-bgCard rounded-xl border border-border p-4 mb-3">
        <h2 className="font-semibold text-text mb-3 text-sm">Your Items</h2>
        <div className="space-y-2">
          {order.items?.map((item, i) => (
            <div key={i} className="flex justify-between items-start">
              <div>
                <p className="text-sm text-text">{item.name} × {item.quantity}</p>
                {item.customizations?.length > 0 && (
                  <p className="text-xs text-textMuted">
                    {item.customizations.map(c => c.selected).join(' · ')}
                  </p>
                )}
              </div>
              <span className="text-sm text-textMuted">₹{item.price * item.quantity}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-border mt-3 pt-3">
          <div className="flex justify-between text-sm font-semibold text-text">
            <span>Total</span>
            <span>₹{order.bill?.total}</span>
          </div>
        </div>
      </div>

      {/* Add more items button */}
      {canModify && (
        <div className="mx-4 mb-3">
          <Button
            data-testid="add-items-btn"
            variant="secondary"
            fullWidth
            onClick={() => navigate(`/menu?hotel=${order.hotelId}&table=${sessionStorage.getItem('tableToken')}`)}
          >
            + Add More Items
          </Button>
        </div>
      )}

      {/* Pay button — shown when served */}
      {isPaid && (
        <div className="fixed bottom-6 left-4 right-4">
          <Button
            data-testid="pay-button"
            fullWidth
            size="lg"
            onClick={() => navigate(`/payment/${orderId}`)}
          >
            Pay ₹{order.bill?.total}
          </Button>
        </div>
      )}
    </div>
  )
}
