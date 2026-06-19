import { useState, useEffect } from 'react'
import { getKDSOrders, kdsAccept, kdsReject, kdsMarkReady } from '../../api/kds.api'
import { useSocket } from '../../hooks/useSocket'
import { useAuthStore } from '../../stores/authStore'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'

// ── Wait timer helpers ─────────────────────────────────────────────────────────
function timerColorClass(createdAt) {
  const mins = (Date.now() - new Date(createdAt).getTime()) / 60000
  if (mins > 10) return 'text-red'
  if (mins > 5)  return 'text-yellow'
  return 'text-green'
}

function timerLabel(createdAt) {
  const secs = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
  const m    = Math.floor(secs / 60)
  const s    = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function playBeep() {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // no audio in test/SSR
  }
}

// ── Reject Modal ───────────────────────────────────────────────────────────────
function RejectModal({ onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative bg-[#1C1C27] border border-white/10 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="font-semibold text-white mb-3">Reject Order — Reason</h3>
        <input
          type="text"
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="e.g. Item out of stock"
          data-testid="kds-reject-reason"
          autoFocus
          className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-accent"
        />
        <div className="flex gap-3 mt-4">
          <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
          <Button data-testid="confirm-reject-btn" variant="danger" fullWidth onClick={() => onConfirm(reason)}>Reject</Button>
        </div>
      </div>
    </div>
  )
}

// ── KDS Order Card ─────────────────────────────────────────────────────────────
function KDSCard({ order, onAccept, onReject, onReady }) {
  const color = timerColorClass(order.createdAt)

  return (
    <div
      data-testid={`kds-card-${order._id}`}
      className="bg-[#1C1C27] border border-white/10 rounded-xl p-4 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-white text-lg">Table {order.tableNumber}</p>
          <p className="text-white/50 text-xs">#{order._id.slice(-4)}</p>
        </div>
        <div className={`font-mono text-sm font-semibold ${color}`} data-testid={`timer-${order._id}`}>
          {timerLabel(order.createdAt)}
        </div>
      </div>

      <div className="space-y-1">
        {order.items?.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-white font-semibold text-sm min-w-[20px]">×{item.quantity}</span>
            <div>
              <p className="text-white text-sm">{item.name}</p>
              {item.customizations?.length > 0 && (
                <p className="text-white/50 text-xs">
                  {item.customizations.map(c => c.selected).join(', ')}
                </p>
              )}
              {item.specialNote && (
                <p className="text-yellow/80 text-xs mt-0.5">📝 {item.specialNote}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        {order.kdsStatus === 'new' && (
          <>
            <button
              data-testid={`accept-btn-${order._id}`}
              onClick={() => onAccept(order._id)}
              className="flex-1 bg-green/20 hover:bg-green/30 border border-green/30 text-green text-sm font-semibold rounded-xl py-2 transition-colors"
            >
              ✓ Accept
            </button>
            <button
              data-testid={`reject-btn-${order._id}`}
              onClick={() => onReject(order._id)}
              className="flex-1 bg-red/20 hover:bg-red/30 border border-red/30 text-red text-sm font-semibold rounded-xl py-2 transition-colors"
            >
              ✕ Reject
            </button>
          </>
        )}
        {['accepted', 'preparing'].includes(order.kdsStatus) && (
          <button
            data-testid={`ready-btn-${order._id}`}
            onClick={() => onReady(order._id)}
            className="flex-1 bg-accent/20 hover:bg-accent/30 border border-accent/30 text-accent text-sm font-semibold rounded-xl py-2 transition-colors"
          >
            🚀 Mark Ready
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main KDS Screen ────────────────────────────────────────────────────────────
export default function KDSScreen() {
  const user    = useAuthStore(s => s.user)
  const hotelId = user?.hotelId

  const [orders,       setOrders]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [rejectTarget, setRejectTarget] = useState(null)

  useEffect(() => {
    const id = setInterval(() => setOrders(o => [...o]), 1000) // tick for timer updates
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    getKDSOrders()
      .then(data => setOrders(data.orders ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const { on } = useSocket({ hotelId, role: 'kitchen', userId: user?._id })

  useEffect(() => {
    if (!hotelId) return
    on('order:new', ({ order }) => {
      playBeep()
      setOrders(prev => prev.some(o => o._id === order._id) ? prev : [order, ...prev])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId])

  const handleAccept = async (orderId) => {
    try {
      await kdsAccept(orderId)
      setOrders(prev => prev.map(o =>
        o._id === orderId ? { ...o, kdsStatus: 'accepted', status: 'preparing' } : o
      ))
    } catch {}
  }

  const handleReject  = (orderId) => setRejectTarget(orderId)

  const confirmReject = async (reason) => {
    if (!rejectTarget) return
    try {
      await kdsReject(rejectTarget, reason)
      setOrders(prev => prev.filter(o => o._id !== rejectTarget))
    } catch {}
    setRejectTarget(null)
  }

  const handleReady = async (orderId) => {
    try {
      await kdsMarkReady(orderId)
      setOrders(prev => prev.filter(o => o._id !== orderId))
    } catch {}
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0A0A0F]">
        <Spinner size="xl" />
      </div>
    )
  }

  const activeOrders = orders.filter(o =>
    ['new', 'accepted', 'preparing'].includes(o.kdsStatus)
  )

  return (
    <div className="min-h-screen bg-[#0A0A0F] pb-8">
      <div className="sticky top-0 z-10 bg-[#0A0A0F]/90 backdrop-blur-md border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-white text-xl">Kitchen Display</h1>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
          <span className="text-green text-xs font-medium">{activeOrders.length} active</span>
        </div>
      </div>

      {activeOrders.length === 0 ? (
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <p className="text-white/40 text-lg">No active orders</p>
        </div>
      ) : (
        <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {activeOrders.map(order => (
            <KDSCard
              key={order._id}
              order={order}
              onAccept={handleAccept}
              onReject={handleReject}
              onReady={handleReady}
            />
          ))}
        </div>
      )}

      {rejectTarget && (
        <RejectModal
          onConfirm={confirmReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  )
}
