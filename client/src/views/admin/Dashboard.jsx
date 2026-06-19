import { useState, useEffect } from 'react'
import { getDashboard } from '../../api/analytics.api'
import { getLiveOrders } from '../../api/order.api'
import { useSocket } from '../../hooks/useSocket'
import { useAuthStore } from '../../stores/authStore'
import { OrderStatusBadge } from '../../components/Badge'
import { Spinner } from '../../components/Spinner'

function MetricCard({ label, value, sub, icon }) {
  return (
    <div data-testid={`metric-${label.toLowerCase().replace(/\s/g, '-')}`}
      className="bg-bgCard border border-border rounded-xl p-4"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-textMuted text-xs font-medium uppercase tracking-wider">{label}</p>
          <p className="font-display font-bold text-2xl text-text mt-1">{value ?? '—'}</p>
          {sub && <p className="text-textMuted text-xs mt-0.5">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const user    = useAuthStore(s => s.user)
  const hotelId = user?.hotelId

  const [dash,    setDash]    = useState(null)
  const [orders,  setOrders]  = useState([])
  const [period,  setPeriod]  = useState('today')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getDashboard(period), getLiveOrders()])
      .then(([dashData, ordersData]) => {
        setDash(dashData)
        setOrders(ordersData.orders ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  const { on } = useSocket({ hotelId, role: 'admin', userId: user?._id })

  useEffect(() => {
    if (!hotelId) return
    on('order:new', ({ order }) => {
      setOrders(prev => prev.some(o => o._id === order._id) ? prev : [order, ...prev])
    })
    on('order:served', ({ orderId }) => {
      setOrders(prev => prev.filter(o => o._id !== orderId))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId])

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="xl" /></div>
  }

  const activeCount = orders.filter(o => !['served', 'rejected', 'cancelled'].includes(o.status)).length

  return (
    <div className="p-4 space-y-4">
      {/* Period selector */}
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl text-text">Dashboard</h2>
        <div className="flex gap-1">
          {['today', 'week', 'month'].map(p => (
            <button
              key={p}
              data-testid={`period-${p}`}
              onClick={() => setPeriod(p)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                period === p
                  ? 'bg-accent text-bg'
                  : 'text-textMuted hover:text-text bg-bgElevated',
              ].join(' ')}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard label="Revenue"      value={`₹${dash?.revenue?.total ?? 0}`}   icon="💰" sub={period} />
        <MetricCard label="Active Orders" value={activeCount}                        icon="📋" sub="live now" />
        <MetricCard label="Tables"        value={orders.length > 0 ? activeCount : 0} icon="🪑" sub="occupied" />
        <MetricCard label="Avg Order"     value={dash?.avgOrderValue ? `₹${Math.round(dash.avgOrderValue)}` : '—'} icon="📊" />
      </div>

      {/* Live orders table */}
      <div className="bg-bgCard border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="font-semibold text-text text-sm">Live Orders</h3>
        </div>
        {orders.length === 0 ? (
          <p className="text-center text-textMuted text-sm py-8">No active orders</p>
        ) : (
          <div className="divide-y divide-border">
            {orders.slice(0, 10).map(order => (
              <div key={order._id} data-testid={`live-order-${order._id}`}
                className="px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-text text-sm font-medium">Table {order.tableNumber}</p>
                  <p className="text-textMuted text-xs">
                    {order.items?.map(i => `${i.name}×${i.quantity}`).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-text text-sm">₹{order.bill?.total}</span>
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
