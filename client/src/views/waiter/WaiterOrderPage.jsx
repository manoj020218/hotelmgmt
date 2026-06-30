import { useState, useEffect } from 'react'
import { getTablesForOrder, getMenuForWaiterOrder, placeWaiterOrder } from '../../api/waiter-order.api'
import { Spinner } from '../../components/Spinner'

// Group menu items by courseType
function groupByCategory(items) {
  const groups = {}
  for (const item of items) {
    const key = item.courseType || item.category || 'Other'
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  }
  return groups
}

// ── Item Row ──────────────────────────────────────────────────────────────────
function ItemRow({ item, qty, onQtyChange }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
      <div className="flex-1 min-w-0 mr-3">
        <p className="text-sm text-text font-medium truncate">{item.name}</p>
        <p className="text-xs text-accent">
          ₹{item.price}
          {item.halfPrice ? <span className="text-textMuted"> / ₹{item.halfPrice} half</span> : null}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onQtyChange(item._id, Math.max(0, qty - 1))}
          disabled={qty === 0}
          className="w-7 h-7 rounded-full border border-border bg-bgElevated text-text text-sm flex items-center justify-center disabled:opacity-30 hover:border-accent transition-colors"
        >
          −
        </button>
        <span className={`w-5 text-center text-sm font-semibold ${qty > 0 ? 'text-accent' : 'text-textDim'}`}>
          {qty || 0}
        </span>
        <button
          onClick={() => onQtyChange(item._id, qty + 1)}
          className="w-7 h-7 rounded-full border border-border bg-bgElevated text-text text-sm flex items-center justify-center hover:border-accent transition-colors"
        >
          +
        </button>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function WaiterOrderPage({ onBack, onOrderPlaced }) {
  const [step,      setStep]      = useState('tables')   // 'tables' | 'menu' | 'confirm' | 'done'
  const [tables,    setTables]    = useState([])
  const [selTable,  setSelTable]  = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [qtys,      setQtys]      = useState({})         // itemId → qty
  const [loading,   setLoading]   = useState(false)
  const [placing,   setPlacing]   = useState(false)
  const [error,     setError]     = useState('')
  const [placed,    setPlaced]    = useState(null)

  // Load tables
  useEffect(() => {
    setLoading(true)
    getTablesForOrder()
      .then(d => setTables(d.tables ?? []))
      .catch(() => setError('Could not load tables'))
      .finally(() => setLoading(false))
  }, [])

  const handleSelectTable = async (table) => {
    setSelTable(table)
    setLoading(true)
    setError('')
    try {
      const d = await getMenuForWaiterOrder(table._id)
      setMenuItems(d.items ?? [])
      setQtys({})
      setStep('menu')
    } catch {
      setError('Could not load menu')
    } finally {
      setLoading(false)
    }
  }

  const handleQtyChange = (itemId, qty) => {
    setQtys(prev => {
      if (qty === 0) { const n = { ...prev }; delete n[itemId]; return n }
      return { ...prev, [itemId]: qty }
    })
  }

  const cartItems = menuItems.filter(m => qtys[m._id] > 0)
  const total     = cartItems.reduce((s, m) => s + m.price * qtys[m._id], 0)

  const handlePlaceOrder = async () => {
    if (!cartItems.length) return
    setPlacing(true)
    setError('')
    try {
      const items = cartItems.map(m => ({
        menuItemId: m._id,
        name:       m.name,
        price:      m.price,
        quantity:   qtys[m._id],
      }))
      const data = await placeWaiterOrder(selTable._id, items)
      setPlaced(data)
      setStep('done')
      if (onOrderPlaced) onOrderPlaced()
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to place order')
    } finally {
      setPlacing(false)
    }
  }

  // ── Table picker ──────────────────────────────────────────────────────────────
  if (step === 'tables') {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <button onClick={onBack} className="text-textMuted hover:text-text text-lg leading-none">←</button>
          <h2 className="font-display font-bold text-text">Select Table</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="xl" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-3">
            {tables.map(t => (
              <button
                key={t._id}
                onClick={() => handleSelectTable(t)}
                className={[
                  'rounded-xl border-2 p-3 text-left transition-colors',
                  t.status === 'available'    ? 'border-green/40 bg-green/5 hover:border-green' :
                  t.status === 'occupied'     ? 'border-accent/40 bg-accent/5 hover:border-accent' :
                  t.status === 'bill_pending' ? 'border-yellow/40 bg-yellow/5 hover:border-yellow' :
                  'border-border bg-bgElevated hover:border-accent/40',
                ].join(' ')}
              >
                <p className="font-bold text-text text-base">T{t.tableNumber}</p>
                <p className="text-xs text-textMuted capitalize">{t.status.replace('_', ' ')}</p>
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-red text-xs text-center pb-4">{error}</p>}
      </div>
    )
  }

  // ── Menu ──────────────────────────────────────────────────────────────────────
  if (step === 'menu') {
    const groups = groupByCategory(menuItems)

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-bg z-10">
          <button onClick={() => setStep('tables')} className="text-textMuted hover:text-text text-lg leading-none">←</button>
          <div className="flex-1">
            <h2 className="font-display font-bold text-text text-sm">Table {selTable?.tableNumber} — Place Order</h2>
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="px-3 py-1.5 bg-accent text-bg rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {placing ? '…' : `Place (₹${total})`}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Spinner size="xl" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {Object.entries(groups).map(([cat, items]) => (
              <div key={cat} className="mt-4">
                <p className="text-xs font-semibold text-textMuted uppercase tracking-wide mb-2">{cat}</p>
                <div className="bg-bgCard border border-border rounded-xl px-3">
                  {items.map(item => (
                    <ItemRow
                      key={item._id}
                      item={item}
                      qty={qtys[item._id] ?? 0}
                      onQtyChange={handleQtyChange}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-red text-xs text-center pb-2">{error}</p>}

        {cartItems.length > 0 && (
          <div className="border-t border-border px-4 py-3 bg-bg">
            <div className="flex justify-between text-sm text-textMuted mb-2">
              <span>{cartItems.length} item{cartItems.length > 1 ? 's' : ''}</span>
              <span className="font-semibold text-accent">₹{total}</span>
            </div>
            <button
              onClick={handlePlaceOrder}
              disabled={placing}
              className="w-full py-3 bg-accent text-bg rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {placing ? 'Placing…' : `Place Order — ₹${total}`}
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── Done ──────────────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
        <div className="text-5xl">✅</div>
        <h2 className="font-display font-bold text-xl text-text">Order Placed</h2>
        <p className="text-textMuted text-sm text-center">
          Order for Table {selTable?.tableNumber} sent to kitchen
        </p>
        <button
          onClick={() => { setStep('tables'); setPlaced(null); setQtys({}) }}
          className="px-5 py-2.5 bg-accent text-bg rounded-xl font-semibold text-sm"
        >
          Place Another Order
        </button>
        <button onClick={onBack} className="text-textMuted text-sm underline">
          Back to Orders
        </button>
      </div>
    )
  }

  return null
}
