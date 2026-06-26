import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCartStore } from '../../stores/cartStore'
import { placeOrder, modifyOrder } from '../../api/order.api'
import { Button } from '../../components/Button'
import { Spinner } from '../../components/Spinner'

function roundTo2(n) {
  return Math.round(n * 100) / 100
}

function BillRow({ label, value, bold = false, dim = false }) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold text-text' : dim ? 'text-textMuted' : 'text-text'}`}>
      <span>{label}</span>
      <span>₹{value}</span>
    </div>
  )
}

export default function CartPage() {
  const navigate = useNavigate()
  const cartItems  = useCartStore(s => s.items)
  const hotelId    = useCartStore(s => s.hotelId)
  const tableToken = useCartStore(s => s.tableToken)
  const { removeItem, updateQuantity, updateNote, clearCart } = useCartStore()

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  // Calculate bill (GST is calculated server-side; show estimated subtotal client-side)
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)

  async function handlePlaceOrder() {
    if (!tableToken) {
      setError('Table not identified — please scan the QR code again')
      return
    }
    setLoading(true)
    setError('')

    const modifyOrderId = sessionStorage.getItem('modifyOrderId')

    try {
      const lineItems = cartItems.map(i => ({
        menuItemId:     i.menuItemId,
        quantity:       i.quantity,
        customizations: i.customizations,
        specialNote:    i.specialNote,
      }))

      if (modifyOrderId) {
        const lastOrder = JSON.parse(sessionStorage.getItem('lastOrder') || '{}')
        await modifyOrder(modifyOrderId, lineItems, lastOrder.sessionId)
        sessionStorage.removeItem('modifyOrderId')
        clearCart()
        navigate(`/order/${modifyOrderId}`, { replace: true })
      } else {
        const data = await placeOrder({ tableQrToken: tableToken, items: lineItems })
        sessionStorage.setItem('lastOrder', JSON.stringify({ orderId: data.orderId, sessionId: data.sessionId }))
        clearCart()
        navigate(`/order/${data.orderId}`, { state: { sessionId: data.sessionId, bill: data.bill } })
      }
    } catch (err) {
      setError(err.response?.data?.error ?? 'Failed — please try again')
    } finally {
      setLoading(false)
    }
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-4 px-4">
        <span className="text-5xl">🛒</span>
        <h2 className="font-display font-semibold text-text text-xl">Your cart is empty</h2>
        <Button onClick={() => navigate(-1)}>Back to Menu</Button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg/90 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-textMuted hover:text-text">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-display font-bold text-xl text-text">Your Order</h1>
      </div>

      {/* Cart Items */}
      <div className="px-4 py-4 space-y-3">
        {cartItems.map((item, idx) => (
          <div key={idx} className="bg-bgCard rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-sm border-2 inline-block ${item.isVeg ? 'border-green' : 'border-red'}`}
                  />
                  <p className="text-sm font-medium text-text">{item.name}</p>
                </div>
                {item.customizations?.length > 0 && (
                  <p className="text-xs text-textMuted mt-0.5 ml-4.5">
                    {item.customizations.map(c => `${c.groupName}: ${c.selected}`).join(' · ')}
                  </p>
                )}
                <p className="text-sm text-accent font-semibold mt-1">₹{item.price} × {item.quantity}</p>
              </div>

              {/* Qty controls */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  aria-label={`Decrease quantity of ${item.name}`}
                  onClick={() => updateQuantity(idx, item.quantity - 1)}
                  className="w-7 h-7 rounded-full bg-bgElevated border border-border text-text flex items-center justify-center text-lg"
                >
                  −
                </button>
                <span className="text-text font-medium w-4 text-center">{item.quantity}</span>
                <button
                  aria-label={`Increase quantity of ${item.name}`}
                  onClick={() => updateQuantity(idx, item.quantity + 1)}
                  className="w-7 h-7 rounded-full bg-bgElevated border border-border text-text flex items-center justify-center text-lg"
                >
                  +
                </button>
              </div>
            </div>

            {/* Special note */}
            <input
              type="text"
              placeholder="Special note (optional)"
              value={item.specialNote || ''}
              onChange={e => updateNote(idx, e.target.value)}
              aria-label={`Special note for ${item.name}`}
              className="mt-2 w-full bg-bgElevated border border-border rounded-lg px-3 py-1.5 text-xs text-text placeholder:text-textDim outline-none focus:border-accent/60"
            />

            <button
              aria-label={`Remove ${item.name}`}
              onClick={() => removeItem(idx)}
              className="mt-2 text-xs text-red hover:text-red/80 transition-colors"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      {/* Bill summary */}
      <div className="mx-4 mt-2 bg-bgCard rounded-xl border border-border p-4 space-y-2">
        <h2 className="font-semibold text-text mb-3">Bill Summary</h2>
        <BillRow label="Subtotal" value={roundTo2(subtotal)} />
        <p className="text-xs text-textMuted">GST will be calculated at checkout</p>
        <div className="border-t border-border pt-2 mt-2">
          <BillRow label="Estimated Total" value={roundTo2(subtotal)} bold />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-3 bg-red/10 border border-red/20 rounded-xl px-4 py-3">
          <p className="text-red text-sm">{error}</p>
        </div>
      )}

      {/* Place Order CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg/95 backdrop-blur-md border-t border-border px-4 py-4">
        <Button
          fullWidth
          size="lg"
          loading={loading}
          onClick={handlePlaceOrder}
          disabled={cartItems.length === 0}
        >
          {sessionStorage.getItem('modifyOrderId') ? 'Add to Order' : 'Place Order'} · ₹{roundTo2(subtotal)}
        </Button>
      </div>
    </div>
  )
}
