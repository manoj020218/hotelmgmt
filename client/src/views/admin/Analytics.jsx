import { useState, useEffect } from 'react'
import { getDashboard, getRevenue, getTopItems, exportCSV } from '../../api/analytics.api'
import { Spinner } from '../../components/Spinner'
import { Button } from '../../components/Button'

function BarChart({ data, labelKey, valueKey, color = 'bg-accent' }) {
  if (!data?.length) return <p className="text-textMuted text-xs text-center py-4">No data</p>
  const max = Math.max(...data.map(d => d[valueKey]))
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <p className="text-textMuted text-xs w-24 truncate flex-shrink-0">{item[labelKey]}</p>
          <div className="flex-1 bg-bgElevated rounded-full h-2 overflow-hidden">
            <div
              className={`h-full ${color} rounded-full transition-all`}
              style={{ width: max ? `${(item[valueKey] / max) * 100}%` : '0%' }}
            />
          </div>
          <p className="text-text text-xs w-16 text-right flex-shrink-0">{item[valueKey]}</p>
        </div>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [period,   setPeriod]   = useState('week')
  const [dash,     setDash]     = useState(null)
  const [revenue,  setRevenue]  = useState([])
  const [topItems, setTopItems] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getDashboard(period),
      getRevenue({ groupBy: 'day', period }),
      getTopItems(),
    ])
      .then(([dashData, revData, itemsData]) => {
        setDash(dashData)
        setRevenue(revData.data ?? [])
        setTopItems(itemsData.items ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [period])

  const handleExport = async () => {
    setExporting(true)
    try {
      const blob = await exportCSV({ period })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `orders-${period}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
    finally { setExporting(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="xl" /></div>
  }

  const payMethods = dash?.paymentMethods ?? {}

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-xl text-text">Analytics</h2>
        <div className="flex gap-2">
          {['today', 'week', 'month'].map(p => (
            <button
              key={p}
              data-testid={`period-${p}`}
              onClick={() => setPeriod(p)}
              className={[
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                period === p ? 'bg-accent text-bg' : 'text-textMuted hover:text-text bg-bgElevated',
              ].join(' ')}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
          <Button data-testid="export-csv-btn" size="sm" variant="secondary" disabled={exporting} onClick={handleExport}>
            {exporting ? '…' : '↓ CSV'}
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Revenue',     value: `₹${dash?.revenue?.total ?? 0}` },
          { label: 'Orders',      value: dash?.orders?.total ?? 0 },
          { label: 'Avg Order',   value: dash?.avgOrderValue ? `₹${Math.round(dash.avgOrderValue)}` : '—' },
          { label: 'Served',      value: dash?.orders?.byStatus?.served ?? 0 },
        ].map(card => (
          <div key={card.label} data-testid={`stat-${card.label.toLowerCase().replace(/\s/g, '-')}`}
            className="bg-bgCard border border-border rounded-xl p-4"
          >
            <p className="text-textMuted text-xs">{card.label}</p>
            <p className="font-display font-bold text-xl text-text mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="bg-bgCard border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text mb-3">Revenue by Day</h3>
        <BarChart
          data={revenue}
          labelKey="date"
          valueKey="revenue"
          color="bg-accent"
        />
      </div>

      {/* Top items */}
      <div className="bg-bgCard border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-text mb-3">Top Items by Revenue</h3>
        <BarChart
          data={topItems.slice(0, 10)}
          labelKey="name"
          valueKey="revenue"
          color="bg-green"
        />
      </div>

      {/* Payment methods */}
      {Object.keys(payMethods).length > 0 && (
        <div className="bg-bgCard border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-text mb-3">Payment Methods</h3>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(payMethods).map(([method, pct]) => (
              <div key={method} className="bg-bgElevated rounded-xl px-3 py-2 text-center">
                <p className="text-text font-bold text-lg">{pct}%</p>
                <p className="text-textMuted text-xs capitalize">{method}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Waiter performance */}
      {dash?.waiterPerformance?.length > 0 && (
        <div className="bg-bgCard border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text">Waiter Performance</h3>
          </div>
          <div className="divide-y divide-border">
            {dash.waiterPerformance.map((w, i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between">
                <p className="text-text text-sm">{w.name}</p>
                <div className="flex items-center gap-4 text-xs text-textMuted">
                  <span>{w.served} orders</span>
                  <span>⭐ {w.avgRating?.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
