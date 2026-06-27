import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPaymentByOrder, requestPayment } from '../../api/payment.api'
import { useSocket } from '../../hooks/useSocket'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'
import { generateReceiptCanvas, downloadReceipt, shareReceipt } from '../../utils/receiptCanvas'

export default function PaymentPage() {
  const { orderId } = useParams()
  const navigate    = useNavigate()

  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [view,      setView]      = useState('methods') // 'methods' | 'qr' | 'cash_wait' | 'upi_done' | 'done'
  const [upiHint,   setUpiHint]   = useState(false)
  const [requesting,setRequesting] = useState(false)
  const [receiptCanvas, setReceiptCanvas] = useState(null)
  const [receiptUrl,    setReceiptUrl]    = useState('')
  const [sharing, setSharing] = useState(false)

  const sessionId = JSON.parse(sessionStorage.getItem('lastOrder') ?? '{}').sessionId

  useEffect(() => {
    if (!orderId) return
    getPaymentByOrder(orderId, sessionId)
      .then(d => setData(d))
      .catch(err => setError(err.response?.data?.error ?? 'Could not load payment'))
      .finally(() => setLoading(false))
  }, [orderId, sessionId])

  const { on } = useSocket({ orderId })

  useEffect(() => {
    if (!orderId) return
    on('payment:received', ({ receiptUrl: url, ...payload }) => {
      if (url) setReceiptUrl(url)
      // Generate receipt image
      if (data?.bill && data?.order) {
        const canvas = generateReceiptCanvas({
          hotelName:   data.hotel?.name,
          tableNumber: data.order?.tableNumber,
          items:       data.order?.items ?? [],
          bill:        data.bill,
          timestamp:   new Date(),
        })
        setReceiptCanvas(canvas)
      }
      setView('done')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, data])

  const handleRequestPayment = async (method) => {
    setRequesting(true)
    try {
      await requestPayment(orderId, sessionId, method)
      setView(method === 'cash' || method === 'card' ? 'cash_wait' : 'upi_done')
    } catch (err) {
      alert(err.response?.data?.error ?? 'Could not notify staff. Please call the waiter.')
    } finally {
      setRequesting(false)
    }
  }

  const handleDownload = async () => {
    if (!receiptCanvas) return
    setSharing(true)
    try { await downloadReceipt(receiptCanvas, `receipt-table${data?.order?.tableNumber}.png`) }
    finally { setSharing(false) }
  }

  const handleShare = async () => {
    if (!receiptCanvas) return
    setSharing(true)
    try { await shareReceipt(receiptCanvas, data?.order?.tableNumber) }
    finally { setSharing(false) }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <Spinner size="xl" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg gap-4 px-4">
        <span className="text-4xl">⚠️</span>
        <p className="text-text">{error || 'Payment info not found'}</p>
        <Button onClick={() => navigate(-1)}>Back</Button>
      </div>
    )
  }

  const { bill, upiDeepLinks, upiQrUrl } = data

  if (view === 'done') {
    return (
      <div data-testid="payment-success" className="flex flex-col items-center justify-center min-h-screen bg-bg gap-6 px-4">
        <div className="text-6xl">✅</div>
        <h1 className="font-display font-bold text-2xl text-text">Payment Received!</h1>
        <p className="text-textMuted text-sm text-center">Thank you for dining with us</p>

        {receiptCanvas && (
          <div className="flex gap-3 w-full max-w-xs">
            <button
              onClick={handleDownload}
              disabled={sharing}
              className="flex-1 py-2 bg-bgElevated border border-border rounded-xl text-sm text-textMuted hover:text-text transition-colors"
            >
              Download Bill
            </button>
            <button
              onClick={handleShare}
              disabled={sharing}
              className="flex-1 py-2 bg-accent text-bg rounded-xl text-sm font-semibold"
            >
              Share Bill
            </button>
          </div>
        )}

        {receiptUrl && (
          <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline text-sm">
            Download PDF Receipt
          </a>
        )}

        <Button onClick={() => navigate(`/feedback/${orderId}`)} fullWidth size="lg">
          Leave Feedback
        </Button>
      </div>
    )
  }

  // Waiting for waiter/admin to collect cash or card
  if (view === 'cash_wait') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg gap-5 px-4">
        <div className="text-5xl">🙋</div>
        <h2 className="font-display font-bold text-xl text-text text-center">Waiter has been notified</h2>
        <p className="text-textMuted text-sm text-center">Staff is on the way to collect your payment of ₹{bill?.total}</p>
        <div className="bg-bgCard border border-border rounded-xl p-4 w-full max-w-sm text-center">
          <p className="text-xs text-textMuted">Please wait at your table</p>
        </div>
        <button onClick={() => setView('methods')} className="text-xs text-textMuted underline">
          Change payment method
        </button>
      </div>
    )
  }

  // Customer says they completed UPI — waiting for staff verification
  if (view === 'upi_done') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg gap-5 px-4">
        <div className="text-5xl">⏳</div>
        <h2 className="font-display font-bold text-xl text-text text-center">Awaiting Confirmation</h2>
        <p className="text-textMuted text-sm text-center">Staff will verify and confirm your UPI payment</p>
        <div className="bg-bgCard border border-border rounded-xl p-4 w-full max-w-sm">
          <div className="flex justify-between text-sm">
            <span className="text-textMuted">Amount</span>
            <span className="text-text font-bold">₹{bill?.total}</span>
          </div>
        </div>
        <button onClick={() => setView('methods')} className="text-xs text-textMuted underline">
          Change payment method
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-8">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur-md border-b border-border px-4 py-3">
        <h1 className="font-display font-bold text-xl text-text">Payment</h1>
      </div>

      {/* Bill */}
      <div className="mx-4 mt-4 bg-bgCard rounded-xl border border-border p-4">
        <h2 className="text-sm font-semibold text-textMuted mb-3">Bill Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-textMuted">
            <span>Subtotal</span>
            <span>₹{bill?.subtotal}</span>
          </div>
          {bill?.gstApplied && (
            <>
              <div className="flex justify-between text-textMuted">
                <span>CGST</span>
                <span>₹{bill?.cgst}</span>
              </div>
              <div className="flex justify-between text-textMuted">
                <span>SGST</span>
                <span>₹{bill?.sgst}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-text border-t border-border pt-2">
            <span>Total</span>
            <span data-testid="total-amount">₹{bill?.total}</span>
          </div>
        </div>
      </div>

      {view === 'methods' && (
        <div className="mx-4 mt-4 space-y-3">
          {/* UPI hint — shown after tapping a UPI app button */}
          {upiHint && (
            <div className="bg-yellow/10 border border-yellow/30 rounded-xl px-4 py-3 text-xs text-yellow leading-relaxed">
              If you see "Something went wrong" in the app — please use <strong>Scan QR</strong> below or tap <strong>I've Paid</strong> if payment went through.
            </div>
          )}

          {/* GPay */}
          {upiDeepLinks?.gpay && (
            <a
              data-testid="gpay-link"
              href={upiDeepLinks.gpay}
              onClick={() => setUpiHint(true)}
              className="flex items-center gap-3 bg-bgCard border border-border rounded-xl px-4 py-4"
            >
              <span className="text-2xl">G</span>
              <div>
                <p className="text-text font-semibold text-sm">Google Pay</p>
                <p className="text-textMuted text-xs">Tap to open GPay</p>
              </div>
            </a>
          )}

          {/* PhonePe */}
          {upiDeepLinks?.phonepay && (
            <a
              data-testid="phonepay-link"
              href={upiDeepLinks.phonepay}
              onClick={() => setUpiHint(true)}
              className="flex items-center gap-3 bg-bgCard border border-border rounded-xl px-4 py-4"
            >
              <span className="text-2xl">P</span>
              <div>
                <p className="text-text font-semibold text-sm">PhonePe</p>
                <p className="text-textMuted text-xs">Tap to open PhonePe</p>
              </div>
            </a>
          )}

          {/* Generic UPI */}
          {upiDeepLinks?.generic && (
            <a
              data-testid="upi-link"
              href={upiDeepLinks.generic}
              onClick={() => setUpiHint(true)}
              className="flex items-center gap-3 bg-bgCard border border-border rounded-xl px-4 py-4"
            >
              <span className="text-2xl">💳</span>
              <div>
                <p className="text-text font-semibold text-sm">Other UPI App</p>
                <p className="text-textMuted text-xs">Choose from installed apps</p>
              </div>
            </a>
          )}

          {/* "I've paid via UPI" — visible after showing UPI hint */}
          {upiHint && (
            <button
              onClick={() => handleRequestPayment('upi')}
              disabled={requesting}
              className="w-full flex items-center justify-center gap-2 bg-accent/10 border border-accent/40 text-accent rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
            >
              {requesting ? <Spinner size="sm" /> : null}
              I've Completed UPI Payment
            </button>
          )}

          {/* Scan QR */}
          {upiQrUrl && (
            <button
              data-testid="scan-qr-btn"
              onClick={() => setView('qr')}
              className="w-full flex items-center gap-3 bg-bgCard border border-border rounded-xl px-4 py-4 text-left"
            >
              <span className="text-2xl">📷</span>
              <div>
                <p className="text-text font-semibold text-sm">Scan QR Code</p>
                <p className="text-textMuted text-xs">Scan hotel's UPI QR to pay</p>
              </div>
            </button>
          )}

          {/* Cash */}
          <button
            data-testid="cash-btn"
            onClick={() => handleRequestPayment('cash')}
            disabled={requesting}
            className="w-full flex items-center gap-3 bg-bgCard border border-border rounded-xl px-4 py-4 text-left disabled:opacity-60"
          >
            <span className="text-2xl">💵</span>
            <div className="flex-1">
              <p className="text-text font-semibold text-sm">Cash</p>
              <p className="text-textMuted text-xs">Notify waiter to collect</p>
            </div>
            {requesting && <Spinner size="sm" />}
          </button>

          {/* Card */}
          <button
            data-testid="card-btn"
            onClick={() => handleRequestPayment('card')}
            disabled={requesting}
            className="w-full flex items-center gap-3 bg-bgCard border border-border rounded-xl px-4 py-4 text-left disabled:opacity-60"
          >
            <span className="text-2xl">💳</span>
            <div className="flex-1">
              <p className="text-text font-semibold text-sm">Card</p>
              <p className="text-textMuted text-xs">Notify waiter with POS machine</p>
            </div>
            {requesting && <Spinner size="sm" />}
          </button>
        </div>
      )}

      {view === 'qr' && (
        <div className="mx-4 mt-4 flex flex-col items-center gap-4">
          <p className="text-textMuted text-sm">Scan with any UPI app</p>
          <img
            data-testid="upi-qr-image"
            src={upiQrUrl}
            alt="UPI QR Code"
            className="w-64 h-64 rounded-xl border border-border"
          />
          <p className="text-textMuted text-xs">Amount: ₹{bill?.total}</p>
          <button
            onClick={() => handleRequestPayment('upi')}
            disabled={requesting}
            className="w-full py-3 bg-green/10 border border-green/40 text-green rounded-xl text-sm font-semibold disabled:opacity-50"
          >
            {requesting ? 'Notifying…' : "I've Paid — Notify Staff"}
          </button>
          <Button variant="secondary" onClick={() => setView('methods')}>Back</Button>
        </div>
      )}
    </div>
  )
}
