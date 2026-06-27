import { useState, useEffect, useRef } from 'react'
import {
  getSettings, updateHotelInfo, updateGST,
  updateOperations, updateKitchen, updatePayment, uploadUpiQr,
  updateWaiterMode,
} from '../../api/settings.api'
import { getAdminTables, assignTableWaiter } from '../../api/table.api'
import { getAllWaiters, createWaiter, deleteWaiter } from '../../api/waiter.api'
import { Spinner } from '../../components/Spinner'

// ── Shared primitives ─────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div className="bg-bgCard border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-textMuted block mb-1">{label}</label>
      {children}
    </div>
  )
}

function TextInput({ testid, value, onChange, placeholder, type = 'text' }) {
  return (
    <input
      data-testid={testid}
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-bgElevated border border-border rounded-lg px-3 py-2 text-text text-sm placeholder-textDim focus:outline-none focus:border-accent"
    />
  )
}

function Toggle({ testid, checked, onChange }) {
  return (
    <button
      data-testid={testid}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-bgElevated border border-border'}`}
    >
      <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

function SaveButton({ testid, loading, onClick, label = 'Save' }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      disabled={loading}
      className="px-4 py-2 bg-accent text-bg rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors"
    >
      {loading ? 'Saving…' : label}
    </button>
  )
}

function StatusMsg({ msg }) {
  if (!msg) return null
  const isErr = msg.startsWith('Error')
  return <p className={`text-xs mt-1 ${isErr ? 'text-red' : 'text-green'}`}>{msg}</p>
}

// ── Waiter mode cards ─────────────────────────────────────────────────────────

const MODES = [
  {
    key:   'table',
    label: 'Table Assignment',
    desc:  'Pre-assign each table to a waiter. Orders auto-assign based on the table zone. Simplest to set up.',
    icon:  '🪑',
  },
  {
    key:   'manual',
    label: 'Manual Dispatch',
    desc:  'Orders arrive unassigned. Admin picks a waiter per order from the Live Orders screen. Enables incentive tracking per order.',
    icon:  '🎯',
  },
  {
    key:   'claim',
    label: 'Waiter Self-Claim',
    desc:  'Orders appear in a shared pool. Waiters claim from their app on first-come basis. Encourages more active service.',
    icon:  '🏃',
  },
]

function ModeCard({ mode, selected, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-4 rounded-xl border-2 transition-colors w-full ${
        selected
          ? 'border-accent bg-accent/5'
          : 'border-border bg-bgElevated hover:border-accent/40'
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{mode.icon}</span>
        <span className="text-sm font-semibold text-text">{mode.label}</span>
        {selected && (
          <span className="ml-auto text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded-full">Active</span>
        )}
      </div>
      <p className="text-xs text-textMuted leading-relaxed">{mode.desc}</p>
    </button>
  )
}

// ── Add Waiter modal ──────────────────────────────────────────────────────────

function AddWaiterModal({ onSave, onClose }) {
  const [form, setForm]   = useState({ name: '', phone: '', pin: '', role: 'waiter' })
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
      <div className="relative bg-bgCard border border-border rounded-2xl p-6 w-full max-w-sm space-y-3">
        <h3 className="font-semibold text-text text-lg">Add Staff</h3>
        <input type="text" placeholder="Name *" value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
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
          className="w-full bg-bgElevated border border-border rounded-xl px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
        >
          <option value="waiter">Waiter</option>
          <option value="kitchen">Kitchen</option>
        </select>
        {error && <p className="text-red text-xs">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 bg-bgElevated border border-border rounded-lg text-sm text-textMuted hover:text-text transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 px-4 py-2 bg-accent text-bg rounded-lg text-sm font-semibold hover:bg-accent/90 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Add'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Staff & Assignment tab ────────────────────────────────────────────────────

function StaffTab({ hotel }) {
  const [mode,    setMode]    = useState(hotel?.settings?.waiterMode ?? 'table')
  const [saving,  setSaving]  = useState(false)
  const [modeMsg, setModeMsg] = useState('')

  const [waiters,  setWaiters]  = useState([])
  const [tables,   setTables]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)

  // tableWaiter[tableId] = waiterId being saved
  const [tableWaiter, setTableWaiter] = useState({})
  const [savingTable, setSavingTable] = useState({})

  useEffect(() => {
    Promise.all([getAllWaiters(), getAdminTables()])
      .then(([wd, td]) => {
        setWaiters((wd.waiters ?? []).filter(w => w.isActive !== false))
        const t = td.tables ?? []
        setTables(t)
        const init = {}
        t.forEach(tb => { init[tb._id] = tb.assignedWaiterId?._id ?? '' })
        setTableWaiter(init)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function flash(text) {
    setModeMsg(text)
    setTimeout(() => setModeMsg(''), 2500)
  }

  async function saveMode(newMode) {
    setSaving(true)
    try {
      await updateWaiterMode(newMode)
      setMode(newMode)
      flash('Mode saved')
    } catch {
      flash('Error saving mode')
    } finally {
      setSaving(false)
    }
  }

  async function handleTableWaiterChange(tableId, waiterId) {
    setTableWaiter(p => ({ ...p, [tableId]: waiterId }))
    setSavingTable(p => ({ ...p, [tableId]: true }))
    try {
      await assignTableWaiter(tableId, waiterId || null)
    } catch {}
    setSavingTable(p => ({ ...p, [tableId]: false }))
  }

  async function handleDeactivate(waiterId) {
    try {
      await deleteWaiter(waiterId)
      setWaiters(prev => prev.filter(w => w._id !== waiterId))
    } catch {}
  }

  const waiterOnly = waiters.filter(w => w.role === 'waiter')

  if (loading) return <div className="flex justify-center py-8"><Spinner /></div>

  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <Section title="Assignment Mode">
        <div className="space-y-3">
          {MODES.map(m => (
            <ModeCard key={m.key} mode={m} selected={mode === m.key}
              onClick={() => mode !== m.key && saveMode(m.key)} />
          ))}
        </div>
        {saving && <p className="text-xs text-textMuted">Saving…</p>}
        <StatusMsg msg={modeMsg} />
      </Section>

      {/* Table → Waiter grid (only visible in 'table' mode) */}
      {mode === 'table' && tables.length > 0 && (
        <Section title="Table → Waiter Assignments">
          <p className="text-xs text-textMuted -mt-2">
            Choose which waiter covers each table. When a customer orders from a table, that waiter is auto-assigned.
          </p>
          <div className="space-y-2">
            {tables.map(tb => (
              <div key={tb._id} className="flex items-center gap-3">
                <span className="text-sm text-text w-16 shrink-0">Table {tb.tableNumber}</span>
                <select
                  value={tableWaiter[tb._id] ?? ''}
                  onChange={e => handleTableWaiterChange(tb._id, e.target.value)}
                  disabled={!!savingTable[tb._id]}
                  className="flex-1 bg-bgElevated border border-border rounded-lg px-3 py-1.5 text-text text-sm focus:outline-none focus:border-accent disabled:opacity-50"
                >
                  <option value="">— Unassigned —</option>
                  {waiterOnly.map(w => (
                    <option key={w._id} value={w._id}>{w.name}</option>
                  ))}
                </select>
                {savingTable[tb._id] && <span className="text-xs text-textMuted">saving…</span>}
              </div>
            ))}
          </div>
          {waiterOnly.length === 0 && (
            <p className="text-xs text-textMuted">No waiters added yet — add staff below first.</p>
          )}
        </Section>
      )}

      {/* Staff roster */}
      <Section title="Staff Roster">
        <div className="flex justify-end -mt-2">
          <button
            onClick={() => setShowAdd(true)}
            className="px-3 py-1.5 bg-accent text-bg rounded-lg text-xs font-semibold hover:bg-accent/90 transition-colors"
          >
            + Add Staff
          </button>
        </div>
        {waiters.length === 0 ? (
          <p className="text-textMuted text-sm text-center py-4">No staff added yet</p>
        ) : (
          <div className="space-y-2">
            {waiters.map(w => (
              <div key={w._id}
                className="flex items-center justify-between bg-bgElevated rounded-lg px-3 py-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-text text-sm font-medium">{w.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${w.role === 'kitchen' ? 'bg-purple/10 text-purple' : 'bg-blue/10 text-blue'}`}>
                      {w.role}
                    </span>
                  </div>
                  <span className="text-textMuted text-xs">{w.phone}</span>
                </div>
                <button
                  onClick={() => handleDeactivate(w._id)}
                  className="text-xs text-red hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>

      {showAdd && (
        <AddWaiterModal
          onSave={u => { setWaiters(p => [...p, u]); setShowAdd(false) }}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  )
}

// ── Main Settings page ────────────────────────────────────────────────────────

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [hotel,   setHotel]   = useState(null)
  const [tab,     setTab]     = useState('general')

  const [info,    setInfo]    = useState({})
  const [gst,     setGst]     = useState({})
  const [ops,     setOps]     = useState({})
  const [kitchen, setKitchen] = useState({})
  const [payment, setPayment] = useState({})

  const [busy, setBusy] = useState({})
  const [msg,  setMsg]  = useState({})

  const upiQrRef = useRef()

  useEffect(() => {
    getSettings()
      .then(d => {
        const h = d.hotel
        setHotel(h)
        setInfo({ name: h.name, address: h.address, phone: h.phone })
        setGst({
          gstEnabled:  h.gstEnabled,
          cgstPercent: h.cgstPercent,
          sgstPercent: h.sgstPercent,
          gstin:       h.gstin,
        })
        setOps({
          kdsEnabled:              h.settings?.kdsEnabled,
          tableVisibilityPublic:   h.settings?.tableVisibilityPublic,
          orderModificationWindow: h.settings?.orderModificationWindow,
        })
        setKitchen({
          kitchenOpen:      h.settings?.kitchenOpen,
          kitchenOpenTime:  h.settings?.kitchenOpenTime  ?? '10:00',
          kitchenCloseTime: h.settings?.kitchenCloseTime ?? '23:00',
        })
        setPayment({
          upiId:       h.upiId,
          receiptFlow: h.settings?.receiptFlow ?? 'customer',
        })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function flash(section, text) {
    setMsg(p => ({ ...p, [section]: text }))
    setTimeout(() => setMsg(p => ({ ...p, [section]: '' })), 3000)
  }

  async function save(section, apiFn, payload) {
    setBusy(p => ({ ...p, [section]: true }))
    try {
      const res = await apiFn(payload)
      setHotel(res.hotel)
      flash(section, 'Saved')
    } catch {
      flash(section, 'Error saving')
    } finally {
      setBusy(p => ({ ...p, [section]: false }))
    }
  }

  async function handleUpiQrUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(p => ({ ...p, upiQr: true }))
    try {
      const res = await uploadUpiQr(file)
      setHotel(prev => ({ ...prev, upiQrUrl: res.upiQrUrl }))
      flash('upiQr', 'QR uploaded')
    } catch {
      flash('upiQr', 'Error uploading')
    } finally {
      setBusy(p => ({ ...p, upiQr: false }))
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Spinner size="xl" /></div>
  }

  return (
    <div className="p-4 max-w-2xl" data-testid="settings-page">
      <h2 className="font-display font-bold text-xl text-text mb-4">Settings</h2>

      {/* Tab bar */}
      <div className="flex gap-2 mb-5 border-b border-border">
        {[
          { key: 'general', label: 'General' },
          { key: 'staff',   label: 'Staff & Assignment' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-accent text-accent'
                : 'border-transparent text-textMuted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div className="space-y-4">
          {/* Hotel Info */}
          <Section title="Hotel Information">
            <Field label="Hotel Name">
              <TextInput testid="hotel-name" value={info.name} onChange={v => setInfo(p => ({ ...p, name: v }))} placeholder="The Grand Spice" />
            </Field>
            <Field label="Address">
              <TextInput testid="hotel-address" value={info.address} onChange={v => setInfo(p => ({ ...p, address: v }))} placeholder="123 MG Road, Bengaluru" />
            </Field>
            <Field label="Phone">
              <TextInput testid="hotel-phone" value={info.phone} onChange={v => setInfo(p => ({ ...p, phone: v }))} placeholder="+91 98765 43210" />
            </Field>
            <div className="flex items-center gap-3">
              <SaveButton testid="save-info-btn" loading={!!busy.info} onClick={() => save('info', updateHotelInfo, info)} />
              <StatusMsg msg={msg.info} />
            </div>
          </Section>

          {/* GST */}
          <Section title="GST Configuration">
            <div className="flex items-center justify-between">
              <span className="text-text text-sm">Enable GST</span>
              <Toggle testid="gst-toggle" checked={!!gst.gstEnabled} onChange={v => setGst(p => ({ ...p, gstEnabled: v }))} />
            </div>
            {gst.gstEnabled && (
              <>
                <Field label="GSTIN">
                  <TextInput testid="gstin-input" value={gst.gstin} onChange={v => setGst(p => ({ ...p, gstin: v }))} placeholder="22AAAAA0000A1Z5" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="CGST %">
                    <TextInput testid="cgst-input" type="number" value={gst.cgstPercent} onChange={v => setGst(p => ({ ...p, cgstPercent: Number(v) }))} placeholder="9" />
                  </Field>
                  <Field label="SGST %">
                    <TextInput testid="sgst-input" type="number" value={gst.sgstPercent} onChange={v => setGst(p => ({ ...p, sgstPercent: Number(v) }))} placeholder="9" />
                  </Field>
                </div>
              </>
            )}
            <div className="flex items-center gap-3">
              <SaveButton testid="save-gst-btn" loading={!!busy.gst} onClick={() => save('gst', updateGST, gst)} />
              <StatusMsg msg={msg.gst} />
            </div>
          </Section>

          {/* Operations */}
          <Section title="Operations">
            {[
              { label: 'KDS Enabled',              key: 'kdsEnabled',           testid: 'kds-toggle' },
              { label: 'Tables Visible to Guests',  key: 'tableVisibilityPublic', testid: 'table-visibility-toggle' },
            ].map(({ label, key, testid }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-text text-sm">{label}</span>
                <Toggle testid={testid} checked={!!ops[key]} onChange={v => setOps(p => ({ ...p, [key]: v }))} />
              </div>
            ))}
            <Field label="Order Modification Window (minutes)">
              <TextInput testid="mod-window-input" type="number" value={ops.orderModificationWindow} onChange={v => setOps(p => ({ ...p, orderModificationWindow: Number(v) }))} placeholder="5" />
            </Field>
            <div className="flex items-center gap-3">
              <SaveButton testid="save-ops-btn" loading={!!busy.ops} onClick={() => save('ops', updateOperations, ops)} />
              <StatusMsg msg={msg.ops} />
            </div>
          </Section>

          {/* Kitchen Hours */}
          <Section title="Kitchen Hours">
            <div className="flex items-center justify-between">
              <span className="text-text text-sm">Kitchen Open</span>
              <Toggle testid="kitchen-open-toggle" checked={!!kitchen.kitchenOpen} onChange={v => setKitchen(p => ({ ...p, kitchenOpen: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Open Time">
                <TextInput testid="open-time-input" value={kitchen.kitchenOpenTime} onChange={v => setKitchen(p => ({ ...p, kitchenOpenTime: v }))} placeholder="10:00" />
              </Field>
              <Field label="Close Time">
                <TextInput testid="close-time-input" value={kitchen.kitchenCloseTime} onChange={v => setKitchen(p => ({ ...p, kitchenCloseTime: v }))} placeholder="23:00" />
              </Field>
            </div>
            <div className="flex items-center gap-3">
              <SaveButton testid="save-kitchen-btn" loading={!!busy.kitchen} onClick={() => save('kitchen', updateKitchen, kitchen)} />
              <StatusMsg msg={msg.kitchen} />
            </div>
          </Section>

          {/* Payment */}
          <Section title="Payment">
            <Field label="UPI ID">
              <TextInput testid="upi-id-input" value={payment.upiId} onChange={v => setPayment(p => ({ ...p, upiId: v }))} placeholder="hotel@okaxis" />
            </Field>
            <Field label="Receipt Flow">
              <select
                data-testid="receipt-flow-select"
                value={payment.receiptFlow ?? 'customer'}
                onChange={e => setPayment(p => ({ ...p, receiptFlow: e.target.value }))}
                className="w-full bg-bgElevated border border-border rounded-lg px-3 py-2 text-text text-sm focus:outline-none focus:border-accent"
              >
                <option value="customer">Customer</option>
                <option value="admin">Admin</option>
                <option value="both">Both</option>
              </select>
            </Field>
            <div className="flex items-center gap-3">
              <SaveButton testid="save-payment-btn" loading={!!busy.payment} onClick={() => save('payment', updatePayment, payment)} />
              <StatusMsg msg={msg.payment} />
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs text-textMuted mb-2">UPI QR Image</p>
              {hotel?.upiQrUrl && (
                <img src={hotel.upiQrUrl} alt="UPI QR" data-testid="upi-qr-preview" className="w-24 h-24 object-cover rounded-lg mb-2" />
              )}
              <input ref={upiQrRef} type="file" accept="image/*" className="hidden"
                onChange={handleUpiQrUpload} data-testid="upi-qr-file-input" />
              <button
                data-testid="upload-upi-qr-btn"
                onClick={() => upiQrRef.current?.click()}
                disabled={!!busy.upiQr}
                className="px-4 py-2 bg-bgElevated border border-border rounded-lg text-sm text-textMuted hover:text-text transition-colors"
              >
                {busy.upiQr ? 'Uploading…' : 'Upload QR Image'}
              </button>
              <StatusMsg msg={msg.upiQr} />
            </div>
          </Section>
        </div>
      )}

      {tab === 'staff' && <StaffTab hotel={hotel} />}
    </div>
  )
}
