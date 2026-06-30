import { useState, useEffect } from 'react'
import { getOrderRecords, deleteAllRecords, deleteBeforeDate } from '../../api/records.api'
import { Spinner } from '../../components/Spinner'

function fmt(date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

// ── Delete Modal ──────────────────────────────────────────────────────────────
function DeleteModal({ mode, onConfirm, onClose }) {
  const [code,   setCode]   = useState('')
  const [date,   setDate]   = useState('')
  const [busy,   setBusy]   = useState(false)
  const [error,  setError]  = useState('')

  const handle = async () => {
    if (!code.trim()) { setError('Enter confirmation code'); return }
    if (mode === 'before' && !date) { setError('Select a date'); return }
    setBusy(true); setError('')
    try {
      await onConfirm({ code: code.trim(), date })
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed — check confirmation code')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-bgCard border border-border rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h3 className="font-bold text-text text-lg">
          {mode === 'all' ? 'Delete All Records' : 'Delete Before Date'}
        </h3>

        <div className="bg-red/10 border border-red/20 rounded-xl px-4 py-3 text-sm text-red leading-relaxed">
          This will permanently delete all orders and payment records.
          This action cannot be undone.
        </div>

        {mode === 'before' && (
          <div>
            <label className="text-xs text-textMuted block mb-1">Delete records before this date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full bg-bgElevated border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent" />
          </div>
        )}

        <div>
          <label className="text-xs text-textMuted block mb-1">Confirmation Code</label>
          <p className="text-xs text-textDim mb-2">
            Request a code from your Super Admin at <span className="text-accent">iotsoft.in/clients</span>. Code is valid for 5 minutes, single use.
          </p>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="6-digit code"
            maxLength={6}
            className="w-full bg-bgElevated border border-border rounded-lg px-3 py-2 text-text text-sm text-center tracking-widest font-mono text-lg focus:outline-none focus:border-accent"
          />
        </div>

        {error && <p className="text-red text-xs">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} disabled={busy}
            className="flex-1 py-2 bg-bgElevated border border-border rounded-lg text-sm text-textMuted hover:text-text transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handle} disabled={busy}
            className="flex-1 py-2 bg-red text-white rounded-lg text-sm font-semibold hover:bg-red/90 transition-colors disabled:opacity-50">
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OrderRecords() {
  const [days,      setDays]      = useState([])   // [{ date, orders[] }]
  const [loading,   setLoading]   = useState(true)
  const [from,      setFrom]      = useState('')
  const [to,        setTo]        = useState('')
  const [expanded,  setExpanded]  = useState({})   // date → bool
  const [deleteMode, setDeleteMode] = useState(null) // 'all' | 'before' | null
  const [deleted,   setDeleted]   = useState(null)

  const load = (params = {}) => {
    setLoading(true)
    getOrderRecords(params)
      .then(d => {
        setDays(d.days ?? [])
        if (d.days?.length > 0) {
          setExpanded({ [d.days[0].date]: true }) // open latest day
        }
      })
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

  const handleDelete = async ({ code, date }) => {
    let result
    if (deleteMode === 'all') {
      result = await deleteAllRecords(code)
    } else {
      result = await deleteBeforeDate(date, code)
    }
    setDeleted(result.deleted)
    setDeleteMode(null)
    load()
  }

  const toggle = (date) => setExpanded(p => ({ ...p, [date]: !p[date] }))

  const totalOrders = days.reduce((s, d) => s + d.orders.length, 0)

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-display font-bold text-xl text-text">Order Records</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setDeleteMode('before')}
            className="px-3 py-1.5 bg-bgElevated border border-border rounded-lg text-xs text-textMuted hover:text-red hover:border-red/40 transition-colors"
          >
            Delete Before Date
          </button>
          <button
            onClick={() => setDeleteMode('all')}
            className="px-3 py-1.5 bg-red/10 border border-red/30 rounded-lg text-xs text-red hover:bg-red/20 transition-colors font-semibold"
          >
            Delete All Records
          </button>
        </div>
      </div>

      {/* Delete success */}
      {deleted && (
        <div className="bg-green/10 border border-green/20 rounded-xl px-4 py-3 text-sm text-green">
          Deleted {deleted.orders} orders and {deleted.payments} payment records.
        </div>
      )}

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
            className="px-3 py-2 bg-bgElevated border border-border rounded-lg text-xs text-textMuted hover:text-text">
            Clear
          </button>
        )}
      </div>

      {/* Summary */}
      {!loading && (
        <p className="text-textMuted text-xs">{totalOrders} orders across {days.length} days</p>
      )}

      {/* Day groups */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="xl" /></div>
      ) : days.length === 0 ? (
        <p className="text-center text-textMuted py-12">No records found</p>
      ) : (
        <div className="space-y-3">
          {days.map(({ date, orders }) => (
            <div key={date} className="bg-bgCard border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => toggle(date)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-bgElevated transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-text text-sm">{date}</span>
                  <span className="text-xs text-textMuted">{orders.length} order{orders.length > 1 ? 's' : ''}</span>
                  <span className="text-xs text-accent">
                    ₹{orders.reduce((s, o) => s + (o.bill?.total ?? 0), 0).toFixed(0)}
                  </span>
                </div>
                <span className="text-textMuted text-sm">{expanded[date] ? '▲' : '▼'}</span>
              </button>

              {expanded[date] && (
                <div className="border-t border-border divide-y divide-border/50">
                  {orders.map(o => (
                    <div key={o._id} className="px-4 py-3">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <span className="text-sm font-medium text-text">Table {o.tableNumber}</span>
                          {o.placedBy?.name && o.placedBy.role !== 'customer' && (
                            <span className="ml-2 text-xs text-blue bg-blue/10 px-1.5 py-0.5 rounded-full">
                              by {o.placedBy.name}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-accent font-semibold text-sm">₹{o.bill?.total?.toFixed(0) ?? '—'}</p>
                          <p className="text-xs text-textMuted">{fmt(o.createdAt)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-textMuted">
                        {o.items?.map(i => `${i.name} ×${i.quantity}`).join(', ')}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                        o.status === 'served'   ? 'bg-green/10 text-green' :
                        o.status === 'rejected' ? 'bg-red/10 text-red' :
                        'bg-textDim/10 text-textDim'
                      }`}>{o.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
      {deleteMode && (
        <DeleteModal
          mode={deleteMode}
          onConfirm={handleDelete}
          onClose={() => setDeleteMode(null)}
        />
      )}
    </div>
  )
}
