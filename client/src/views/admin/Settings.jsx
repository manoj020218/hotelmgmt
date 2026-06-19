import { useState, useEffect, useRef } from 'react'
import {
  getSettings, updateHotelInfo, updateGST,
  updateOperations, updateKitchen, updatePayment, uploadUpiQr,
} from '../../api/settings.api'
import { Spinner } from '../../components/Spinner'

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
  return (
    <p className={`text-xs mt-1 ${isErr ? 'text-red' : 'text-green'}`}>{msg}</p>
  )
}

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [hotel, setHotel]     = useState(null)

  // section-level form state
  const [info, setInfo]     = useState({})
  const [gst, setGst]       = useState({})
  const [ops, setOps]       = useState({})
  const [kitchen, setKitchen] = useState({})
  const [payment, setPayment] = useState({})

  // per-section busy / status
  const [busy, setBusy] = useState({})
  const [msg, setMsg]   = useState({})

  const upiQrRef = useRef()

  useEffect(() => {
    getSettings()
      .then(d => {
        const h = d.hotel
        setHotel(h)
        setInfo({ name: h.name, address: h.address, phone: h.phone })
        setGst({
          gstEnabled: h.gstEnabled,
          cgstPercent: h.cgstPercent,
          sgstPercent: h.sgstPercent,
          gstin: h.gstin,
        })
        setOps({
          kdsEnabled:             h.settings?.kdsEnabled,
          tableVisibilityPublic:  h.settings?.tableVisibilityPublic,
          autoWaiterAssign:       h.settings?.autoWaiterAssign,
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
    <div className="p-4 space-y-4 max-w-2xl" data-testid="settings-page">
      <h2 className="font-display font-bold text-xl text-text">Settings</h2>

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
          { label: 'KDS Enabled',             key: 'kdsEnabled',            testid: 'kds-toggle' },
          { label: 'Tables Visible to Guests', key: 'tableVisibilityPublic', testid: 'table-visibility-toggle' },
          { label: 'Auto-Assign Waiter',       key: 'autoWaiterAssign',      testid: 'auto-assign-toggle' },
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

        {/* UPI QR Upload */}
        <div className="border-t border-border pt-4">
          <p className="text-xs text-textMuted mb-2">UPI QR Image</p>
          {hotel?.upiQrUrl && (
            <img src={hotel.upiQrUrl} alt="UPI QR" data-testid="upi-qr-preview" className="w-24 h-24 object-cover rounded-lg mb-2" />
          )}
          <input
            ref={upiQrRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpiQrUpload}
            data-testid="upi-qr-file-input"
          />
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
  )
}
