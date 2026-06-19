import { useState, useEffect } from 'react'
import { getAdminTables, createTable, updateTableStatus, getTableQR } from '../../api/table.api'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'

const STATUS_COLORS = {
  available: 'border-green/40 bg-green/10 text-green',
  occupied:  'border-accent/40 bg-accent/10 text-accent',
  reserved:  'border-blue/40 bg-blue/10 text-blue',
  blocked:   'border-red/40 bg-red/10 text-red',
}

function TableCard({ table, onStatusChange, onDownloadQR }) {
  return (
    <div
      data-testid={`table-card-${table._id}`}
      className={`border rounded-xl p-4 ${STATUS_COLORS[table.status] ?? 'border-border'}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-bold text-text text-lg">T{table.tableNumber}</p>
          <p className="text-textMuted text-xs">Cap {table.capacity}</p>
        </div>
        <span className="text-xs font-medium capitalize">{table.status}</span>
      </div>
      <div className="flex gap-2 mt-3">
        <select
          data-testid={`status-select-${table._id}`}
          value={table.status}
          onChange={e => onStatusChange(table._id, e.target.value)}
          className="flex-1 bg-bgElevated border border-border rounded-lg px-2 py-1 text-text text-xs focus:outline-none"
        >
          {['available', 'occupied', 'reserved', 'blocked'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          data-testid={`qr-btn-${table._id}`}
          onClick={() => onDownloadQR(table._id)}
          className="px-2 py-1 text-xs bg-bgElevated border border-border rounded-lg text-textMuted hover:text-text"
        >
          QR
        </button>
      </div>
      {table.notes?.length > 0 && (
        <div className="mt-2 space-y-1">
          {table.notes.map((n, i) => (
            <p key={i} className="text-xs text-yellow">{n.tag && `[${n.tag}] `}{n.text}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TableManager() {
  const [tables,  setTables]  = useState([])
  const [loading, setLoading] = useState(true)
  const [newNum,  setNewNum]  = useState('')
  const [newCap,  setNewCap]  = useState('4')
  const [adding,  setAdding]  = useState(false)

  useEffect(() => {
    getAdminTables()
      .then(data => setTables(data.tables ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleStatusChange = async (tableId, status) => {
    try {
      const data = await updateTableStatus(tableId, { status })
      setTables(prev => prev.map(t => t._id === tableId ? data.table : t))
    } catch {}
  }

  const handleDownloadQR = async (tableId) => {
    try {
      const data = await getTableQR(tableId)
      if (data.qrCodeUrl) window.open(data.qrCodeUrl, '_blank')
    } catch {}
  }

  const handleAddTable = async () => {
    if (!newNum) return
    setAdding(true)
    try {
      const data = await createTable({ tableNumber: Number(newNum), capacity: Number(newCap) })
      setTables(prev => [...prev, data.table])
      setNewNum('')
    } catch {}
    finally { setAdding(false) }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="xl" /></div>
  }

  return (
    <div className="p-4">
      <h2 className="font-display font-bold text-xl text-text mb-4">Tables</h2>

      <div className="bg-bgCard border border-border rounded-xl p-4 mb-4 flex gap-3 items-end">
        <div className="flex-1">
          <p className="text-xs text-textMuted mb-1">Table Number</p>
          <input
            type="number"
            value={newNum}
            onChange={e => setNewNum(e.target.value)}
            placeholder="e.g. 13"
            data-testid="new-table-num"
            className="w-full bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex-1">
          <p className="text-xs text-textMuted mb-1">Capacity</p>
          <input
            type="number"
            value={newCap}
            onChange={e => setNewCap(e.target.value)}
            className="w-full bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
          />
        </div>
        <Button data-testid="add-table-btn" size="sm" disabled={adding} onClick={handleAddTable}>
          Add
        </Button>
      </div>

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {tables.map(table => (
          <TableCard
            key={table._id}
            table={table}
            onStatusChange={handleStatusChange}
            onDownloadQR={handleDownloadQR}
          />
        ))}
      </div>
    </div>
  )
}
