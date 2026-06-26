import { useState, useEffect } from 'react'
import { getTodayPayments, markPaymentReceived } from '../../api/payment.api'
import { useSocket } from '../../hooks/useSocket'
import { useAuthStore } from '../../stores/authStore'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'

const METHODS = ['cash', 'card', 'upi', 'gpay', 'phonepay']

export default function Payments() {
  const [data,    setData]    = useState(null)  // { payments, totalCollected, byMethod, pending }
  const [loading, setLoading] = useState(true)
  const user    = useAuthStore(s => s.user)
  const { on }  = useSocket({ hotelId: user?.hotelId, role: 'admin', userId: user?._id })

  useEffect(() => {
    getTodayPayments()
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    on('payment:received', (payload) => {
      setData(prev => {
        if (!prev) return prev
        const updated = prev.payments.map(p =>
          p._id === payload.paymentId
            ? { ...p, status: 'received', method: payload.method, receiptUrl: payload.receiptUrl }
            : p
        )
        const nowReceived = updated.find(p => p._id === payload.paymentId)
        return {
          ...prev,
          payments:       updated,
          pending:        prev.pending.filter(p => p._id !== payload.paymentId),
          totalCollected: (prev.totalCollected ?? 0) + (nowReceived?.amount ?? payload.amount ?? 0),
        }
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.hotelId])

  const handleMarkReceived = async (paymentId, method) => {
    try {
      const result = await markPaymentReceived(paymentId, { method })
      setData(prev => ({
        ...prev,
        payments: prev.payments.map(p => p._id === paymentId ? result.payment : p),
        pending:  prev.pending.filter(p => p._id !== paymentId),
        totalCollected: (prev.totalCollected ?? 0) + (result.payment.amount ?? 0),
      }))
    } catch {}
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="xl" /></div>
  }

  const { payments = [], totalCollected = 0, byMethod = {}, pending = [] } = data ?? {}

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-display font-bold text-xl text-text">Payments</h2>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div data-testid="total-collected" className="bg-bgCard border border-border rounded-xl p-4">
          <p className="text-textMuted text-xs">Today's Collections</p>
          <p className="font-bold text-2xl text-accent mt-1">₹{totalCollected}</p>
        </div>
        <div className="bg-bgCard border border-border rounded-xl p-4">
          <p className="text-textMuted text-xs mb-2">By Method</p>
          <div className="space-y-1">
            {Object.entries(byMethod).map(([m, amt]) => (
              <div key={m} className="flex justify-between text-xs">
                <span className="text-textMuted capitalize">{m}</span>
                <span className="text-text">₹{amt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pending payments */}
      {pending.length > 0 && (
        <div className="bg-bgCard border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text">Pending ({pending.length})</h3>
          </div>
          <div className="divide-y divide-border">
            {pending.map(p => (
              <div key={p._id} data-testid={`pending-${p._id}`}
                className="px-4 py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="text-text text-sm font-medium">Table {p.tableNumber}</p>
                  <p className="text-accent font-semibold text-sm">₹{p.amount}</p>
                </div>
                <div className="flex gap-1">
                  {METHODS.map(m => (
                    <button
                      key={m}
                      data-testid={`mark-${m}-${p._id}`}
                      onClick={() => handleMarkReceived(p._id, m)}
                      className="px-2 py-1 bg-bgElevated border border-border rounded-lg text-xs text-textMuted hover:text-text hover:border-accent transition-colors capitalize"
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All payments list */}
      <div className="bg-bgCard border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-text">All Payments Today</h3>
        </div>
        {payments.length === 0 ? (
          <p className="text-center text-textMuted text-sm py-8">No payments today</p>
        ) : (
          <div className="divide-y divide-border">
            {payments.map(p => (
              <div key={p._id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-text text-sm">Table {p.tableNumber}</p>
                  <p className="text-textMuted text-xs capitalize">{p.method} · {p.status}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-accent font-semibold">₹{p.amount}</span>
                  {p.receiptUrl && (
                    <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue hover:underline"
                    >
                      Receipt
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
