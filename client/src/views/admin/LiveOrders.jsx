import { useState, useEffect } from 'react'
import { getLiveOrders, updateOrderStatus, assignOrderWaiter } from '../../api/order.api'
import { getSettings } from '../../api/settings.api'
import { getAllWaiters } from '../../api/waiter.api'
import { useSocket } from '../../hooks/useSocket'
import { useAuthStore } from '../../stores/authStore'
import { OrderStatusBadge } from '../../components/Badge'
import { Spinner } from '../../components/Spinner'

// Inline waiter assign dropdown for manual mode
function AssignDropdown({ orderId, waiters, onAssigned }) {
  const [open,    setOpen]    = useState(false)
  const [saving,  setSaving]  = useState(false)

  async function pick(waiterId) {
    setSaving(true)
    try {
      const data = await assignOrderWaiter(orderId, waiterId)
      onAssigned(data.order)
    } catch {}
    setSaving(false)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className="px-3 py-1 rounded-lg text-xs font-medium bg-bgElevated border border-border text-textMuted hover:text-text transition-colors"
      >
        {saving ? 'Saving…' : 'Assign ▾'}
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 bg-bgCard border border-border rounded-xl shadow-lg py-1 min-w-[140px]">
          {waiters.length === 0 && (
            <p className="px-3 py-2 text-xs text-textMuted">No waiters found</p>
          )}
          {waiters.map(w => (
            <button key={w._id} onClick={() => pick(w._id)}
              className="w-full text-left px-3 py-2 text-sm text-text hover:bg-bgElevated transition-colors">
              {w.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function LiveOrders() {
  const user    = useAuthStore(s => s.user)
  const hotelId = user?.hotelId

  const [orders,     setOrders]     = useState([])
  const [waiters,    setWaiters]    = useState([])
  const [waiterMode, setWaiterMode] = useState('table')
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    Promise.all([getLiveOrders(), getSettings(), getAllWaiters()])
      .then(([od, sd, wd]) => {
        setOrders(od.orders ?? [])
        setWaiterMode(sd.hotel?.settings?.waiterMode ?? 'table')
        setWaiters((wd.waiters ?? []).filter(w => w.role === 'waiter' && w.isActive !== false))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const { on } = useSocket({ hotelId, role: 'admin', userId: user?._id })

  useEffect(() => {
    if (!hotelId) return
    on('order:new', ({ order }) => {
      setOrders(prev => prev.some(o => o._id === order._id) ? prev : [order, ...prev])
    })
    on('order:assigned', ({ orderId, waiterName, waiterId }) => {
      setOrders(prev => prev.map(o =>
        o._id === orderId
          ? { ...o, status: 'assigned', assignedWaiterId: { _id: waiterId, name: waiterName } }
          : o
      ))
    })
    on('order:served',   ({ orderId }) => setOrders(prev => prev.filter(o => o._id !== orderId)))
    on('order:rejected', ({ orderId }) => setOrders(prev => prev.filter(o => o._id !== orderId)))
    on('order:modified', ({ orderId, bill }) => {
      setOrders(prev => prev.map(o => o._id === orderId ? { ...o, bill } : o))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId])

  const handleOverride = async (orderId, status) => {
    try {
      await updateOrderStatus(orderId, status)
      if (status === 'served') {
        setOrders(prev => prev.filter(o => o._id !== orderId))
      } else {
        setOrders(prev => prev.map(o => o._id === orderId ? { ...o, status } : o))
      }
    } catch {}
  }

  function handleAssigned(updatedOrder) {
    setOrders(prev => prev.map(o => o._id === updatedOrder._id ? { ...o, ...updatedOrder } : o))
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="xl" /></div>
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-xl text-text">Live Orders</h2>
        <span className="text-xs text-textMuted bg-bgCard border border-border px-2 py-1 rounded-lg capitalize">
          Mode: {waiterMode === 'table' ? 'Table Assign' : waiterMode === 'manual' ? 'Manual' : 'Self-Claim'}
        </span>
      </div>

      {orders.length === 0 ? (
        <div className="bg-bgCard border border-border rounded-xl p-8 text-center">
          <p className="text-textMuted">No active orders right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const waiterName = order.assignedWaiterId?.name ?? order.waiterName ?? null

            return (
              <div key={order._id} data-testid={`order-row-${order._id}`}
                className="bg-bgCard border border-border rounded-xl p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-text">Table {order.tableNumber}</p>
                    <p className="text-textMuted text-xs">
                      {new Date(order.createdAt).toLocaleTimeString()}
                      {waiterName
                        ? <span className="text-green"> · {waiterName}</span>
                        : waiterMode === 'claim'
                          ? <span className="text-yellow-500"> · Unclaimed</span>
                          : waiterMode === 'manual'
                            ? <span className="text-textDim"> · Unassigned</span>
                            : null
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-text text-sm font-medium">₹{order.bill?.total}</span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </div>

                <p className="text-textMuted text-xs mb-3">
                  {order.items?.map(i => `${i.name} ×${i.quantity}`).join(', ')}
                </p>

                <div className="flex gap-2 flex-wrap">
                  <button
                    data-testid={`mark-served-${order._id}`}
                    onClick={() => handleOverride(order._id, 'served')}
                    className="px-3 py-1.5 bg-bgElevated border border-border rounded-lg text-xs font-medium text-text hover:border-accent transition-colors"
                  >
                    Mark Served
                  </button>

                  {waiterMode === 'manual' && (
                    <AssignDropdown
                      orderId={order._id}
                      waiters={waiters}
                      onAssigned={handleAssigned}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
