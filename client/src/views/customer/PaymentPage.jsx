import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getPaymentByOrder } from '../../api/payment.api'
import { useSocket } from '../../hooks/useSocket'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'

export default function PaymentPage() {
  const { orderId } = useParams()
  const navigate    = useNavigate()

  const [data,     setData]     = useState(null)   // { payment, order, bill, upiDeepLinks, upiQrUrl }
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [paid,     setPaid]     = useState(false)
  const [receiptUrl, setReceiptUrl] = useState('')
  const [view,     setView]     = useState('methods') // 'methods' | 'qr' | 'cash' | 'done'
  const [upiHint,  setUpiHint]  = useState(false)

  useEffect(() => {
    if (!orderId) return
    const sessionId = JSON.parse(sessionStorage.getItem('lastOrder') ?? '{}').sessionId
    getPaymentByOrder(orderId, sessionId)
      .then(d => setData(d))
      .catch(err => setError(err.response?.data?.error ?? 'Could not load payment'))
      .finally(() => setLoading(false))
  }, [orderId])

  // Socket — listen for payment confirmation
  const { on } = useSocket({ orderId })

  useEffect(() => {
    if (!orderId) return
    on('payment:received', ({ receiptUrl: url }) => {
      setPaid(true)
      if (url) setReceiptUrl(url)
      setView('done')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

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
        {receiptUrl && (
          <a
            data-testid="receipt-link"
            href={receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline text-sm"
          >
            Download Receipt
          </a>
        )}
        <Button
          onClick={() => navigate(`/feedback/${orderId}`)}
          fullWidth
          size="lg"
        >
          Leave Feedback
        </Button>
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
          {/* UPI hint — shown after tapping a UPI button */}
          {upiHint && (
            <div className="bg-yellow/10 border border-yellow/30 rounded-xl px-4 py-3 text-xs text-yellow leading-relaxed">
              If you see "Something went wrong" in the payment app — please use <strong>Scan QR</strong> below or ask the waiter to collect payment.
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
                <p className="text-textMuted text-xs">Scan hotel's UPI QR</p>
              </div>
            </button>
          )}

          {/* Cash / Card */}
          <button
            data-testid="cash-btn"
            onClick={() => setView('cash')}
            className="w-full flex items-center gap-3 bg-bgCard border border-border rounded-xl px-4 py-4 text-left"
          >
            <span className="text-2xl">💵</span>
            <div>
              <p className="text-text font-semibold text-sm">Cash / Card</p>
              <p className="text-textMuted text-xs">Waiter will collect payment</p>
            </div>
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
          <Button variant="secondary" onClick={() => setView('methods')}>Back</Button>
        </div>
      )}

      {view === 'cash' && (
        <div
          data-testid="cash-info"
          className="mx-4 mt-4 bg-bgCard border border-border rounded-xl p-6 text-center"
        >
          <p className="text-4xl mb-3">🙋</p>
          <p className="text-text font-semibold">Waiter will collect payment</p>
          <p className="text-textMuted text-sm mt-1">Amount: ₹{bill?.total}</p>
          <Button variant="secondary" className="mt-4" onClick={() => setView('methods')}>Back</Button>
        </div>
      )}
    </div>
  )
}
