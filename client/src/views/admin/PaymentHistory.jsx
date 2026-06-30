import { useState, useEffect } from 'react'
import { getPaymentHistory } from '../../api/payment.api'
import { Spinner } from '../../components/Spinner'

const METHOD_LABEL = { cash: 'Cash', card: 'Card', upi: 'UPI', gpay: 'GPay', phonepay: 'PhonePe' }
const STATUS_CLS   = { received: 'text-green', pending: 'text-yellow', disputed: 'text-red' }

function fmt(date) {
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export default function PaymentHistory() {
  const [payments, setPayments] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [from,     setFrom]     = useState('')
  const [to,       setTo]       = useState('')

  const load = (params = {}) => {
    setLoading(true)
    getPaymentHistory(params)
      .then(d => setPayments(d.payments ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleFilter = () => {
    const p = {}
    if (from) p.from = from
    if (to)   p.to   = to
    load(p)
  }

  const totalReceived = payments.filter(p => p.status === 'received').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-display font-bold text-xl text-text">Payment History</h2>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-end">
        <div>
          <label className="text-xs text-textMuted block mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="bg-bgElevated border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent" />
        </div>
        <div>
          <label className="text-xs text-textMuted block mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            className="bg-bgElevated border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent" />
        </div>
        <button onClick={handleFilter}
          className="px-4 py-2 bg-accent text-bg rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors">
          Filter
        </button>
        {(from || to) && (
          <button onClick={() => { setFrom(''); setTo(''); load() }}
            className="px-3 py-2 bg-bgElevated border border-border rounded-lg text-xs text-textMuted hover:text-text transition-colors">
            Clear
          </button>
        )}
      </div>

      {/* Summary */}
      {!loading && payments.length > 0 && (
        <div className="bg-bgCard border border-border rounded-xl p-4 flex items-center justify-between">
          <p className="text-textMuted text-sm">{payments.length} transactions</p>
          <p className="font-bold text-accent text-lg">₹{totalReceived.toFixed(0)} collected</p>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="xl" /></div>
      ) : payments.length === 0 ? (
        <p className="text-center text-textMuted py-12">No payments found</p>
      ) : (
        <div className="bg-bgCard border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-textMuted text-xs">
                  <th className="px-4 py-2 text-left">Date / Time</th>
                  <th className="px-4 py-2 text-left">Table</th>
                  <th className="px-4 py-2 text-left">Amount</th>
                  <th className="px-4 py-2 text-left">Method</th>
                  <th className="px-4 py-2 text-left">Collected By</th>
                  <th className="px-4 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.map(p => (
                  <tr key={p._id} className="hover:bg-bgElevated transition-colors">
                    <td className="px-4 py-3 text-textMuted text-xs whitespace-nowrap">
                      {p.receivedAt ? fmt(p.receivedAt) : fmt(p.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-text font-medium">T{p.tableNumber}</td>
                    <td className="px-4 py-3 text-accent font-semibold">₹{p.amount}</td>
                    <td className="px-4 py-3 text-textMuted capitalize">
                      {METHOD_LABEL[p.method] ?? p.method}
                    </td>
                    <td className="px-4 py-3 text-text">
                      {p.receivedBy?.name ?? <span className="text-textDim">—</span>}
                    </td>
                    <td className={`px-4 py-3 font-medium capitalize ${STATUS_CLS[p.status] ?? 'text-textMuted'}`}>
                      {p.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
