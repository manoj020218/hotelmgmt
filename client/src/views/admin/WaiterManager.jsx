import { useState, useEffect } from 'react'
import { getAllWaiters, createWaiter, updateWaiter, deleteWaiter } from '../../api/waiter.api'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'

function AddWaiterModal({ onSave, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', pin: '', role: 'waiter' })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.pin) { setError('All fields required'); return }
    setSaving(true); setError('')
    try {
      const data = await createWaiter(form)
      onSave(data.user)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed to add')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div data-testid="add-waiter-modal" className="relative bg-bgCard border border-border rounded-2xl p-6 w-full max-w-sm space-y-3">
        <h3 className="font-semibold text-text text-lg">Add Staff</h3>
        <input type="text" placeholder="Name *" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          data-testid="waiter-name-input"
          className="w-full bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
        />
        <input type="tel" placeholder="Phone *" value={form.phone}
          onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          className="w-full bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
        />
        <input type="password" placeholder="4-digit PIN *" value={form.pin} maxLength={4}
          onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
          className="w-full bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
        />
        <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
          data-testid="waiter-role-select"
          className="w-full bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
        >
          <option value="waiter">Waiter</option>
          <option value="kitchen">Kitchen</option>
        </select>
        {error && <p className="text-red text-xs" data-testid="waiter-modal-error">{error}</p>}
        <div className="flex gap-3 pt-1">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth disabled={saving} onClick={handleSubmit} data-testid="save-waiter-btn">
            {saving ? 'Saving…' : 'Add'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function WaiterManager() {
  const [waiters,  setWaiters]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)

  useEffect(() => {
    getAllWaiters()
      .then(data => setWaiters(data.waiters ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDeactivate = async (waiterId) => {
    try {
      await deleteWaiter(waiterId)
      setWaiters(prev => prev.map(w => w._id === waiterId ? { ...w, isActive: false } : w))
    } catch {}
  }

  const handleSaved = (user) => {
    setWaiters(prev => [...prev, user])
    setShowAdd(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="xl" /></div>
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display font-bold text-xl text-text">Staff</h2>
        <Button data-testid="add-staff-btn" size="sm" onClick={() => setShowAdd(true)}>
          + Add Staff
        </Button>
      </div>

      <div className="space-y-3">
        {waiters.map(w => (
          <div key={w._id} data-testid={`waiter-row-${w._id}`}
            className="bg-bgCard border border-border rounded-xl px-4 py-3 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="text-text text-sm font-medium">{w.name}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${w.role === 'kitchen' ? 'bg-purple/10 text-purple' : 'bg-blue/10 text-blue'}`}>
                  {w.role}
                </span>
                {!w.isActive && <span className="text-xs text-red">Inactive</span>}
              </div>
              <p className="text-textMuted text-xs mt-0.5">{w.phone} · ⭐ {w.stats?.avgRating?.toFixed(1) ?? '—'}</p>
            </div>
            {w.isActive !== false && (
              <button
                data-testid={`deactivate-${w._id}`}
                onClick={() => handleDeactivate(w._id)}
                className="text-xs text-red hover:underline"
              >
                Deactivate
              </button>
            )}
          </div>
        ))}
      </div>

      {showAdd && <AddWaiterModal onSave={handleSaved} onClose={() => setShowAdd(false)} />}
    </div>
  )
}
