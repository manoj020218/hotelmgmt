import { useState, useEffect } from 'react'
import { getLiveOrders, updateOrderStatus } from '../../api/order.api'
import { useSocket } from '../../hooks/useSocket'
import { useAuthStore } from '../../stores/authStore'
import { OrderStatusBadge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'

export default function LiveOrders() {
  const user    = useAuthStore(s => s.user)
  const hotelId = user?.hotelId

  const [orders,  setOrders]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getLiveOrders()
      .then(data => setOrders(data.orders ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const { on } = useSocket({ hotelId, role: 'admin', userId: user?._id })

  useEffect(() => {
    if (!hotelId) return
    on('order:new', ({ order }) => {
      setOrders(prev => prev.some(o => o._id === order._id) ? prev : [order, ...prev])
    })
    on('order:assigned', ({ orderId, waiterName }) => {
      setOrders(prev => prev.map(o =>
        o._id === orderId ? { ...o, status: 'assigned', waiterName } : o
      ))
    })
    on('order:served', ({ orderId }) => {
      setOrders(prev => prev.filter(o => o._id !== orderId))
    })
    on('order:rejected', ({ orderId }) => {
      setOrders(prev => prev.filter(o => o._id !== orderId))
    })
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

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="xl" /></div>
  }

  return (
    <div className="p-4">
      <h2 className="font-display font-bold text-xl text-text mb-4">Live Orders</h2>
      {orders.length === 0 ? (
        <div className="bg-bgCard border border-border rounded-xl p-8 text-center">
          <p className="text-textMuted">No active orders right now</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => (
            <div key={order._id} data-testid={`order-row-${order._id}`}
              className="bg-bgCard border border-border rounded-xl p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-text">Table {order.tableNumber}</p>
                  <p className="text-textMuted text-xs">
                    {new Date(order.createdAt).toLocaleTimeString()}
                    {order.waiterName && ` · ${order.waiterName}`}
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
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  data-testid={`mark-served-${order._id}`}
                  onClick={() => handleOverride(order._id, 'served')}
                >
                  Mark Served
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
