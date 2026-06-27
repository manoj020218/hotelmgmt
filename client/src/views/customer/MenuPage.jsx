import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getMenu } from '../../api/menu.api'
import { useCartStore } from '../../stores/cartStore'
import { Spinner } from '../../components/Spinner'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'

// ── Category Tabs ─────────────────────────────────────────────────────────────
function CategoryTabs({ categories, selected, onChange }) {
  const all = ['All', ...categories]
  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {all.map(cat => (
        <button
          key={cat}
          role="tab"
          aria-selected={selected === cat}
          onClick={() => onChange(cat)}
          className={[
            'flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors',
            selected === cat
              ? 'bg-accent text-bg'
              : 'bg-bgElevated text-textMuted border border-border hover:text-text',
          ].join(' ')}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}

// ── Veg / Non-veg dot ─────────────────────────────────────────────────────────
function VegDot({ isVeg }) {
  return (
    <span
      className={`inline-block w-3 h-3 rounded-sm border-2 ${
        isVeg ? 'border-green' : 'border-red'
      }`}
    >
      <span className={`block w-1.5 h-1.5 rounded-full m-px ${isVeg ? 'bg-green' : 'bg-red'}`} />
    </span>
  )
}

// ── Menu Item Card ────────────────────────────────────────────────────────────
function MenuItemCard({ item, kitchenOpen, onTap, onAdd }) {
  const hasCustomizations = item.customizationOptions?.length > 0

  return (
    <div
      onClick={() => onTap(item)}
      className="bg-bgCard rounded-xl border border-border overflow-hidden cursor-pointer hover:border-accent/30 transition-colors"
    >
      {item.photoUrl ? (
        <img
          src={item.photoUrl}
          alt={item.name}
          className="w-full h-28 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-28 flex items-center justify-center bg-bgElevated text-3xl">
          🍽️
        </div>
      )}

      <div className="p-3">
        <div className="flex items-start gap-1.5 mb-1">
          <VegDot isVeg={item.isVeg} />
          <p className="text-sm font-medium text-text leading-tight flex-1">{item.name}</p>
        </div>

        {item.tags?.length > 0 && (
          <div className="flex gap-1 mb-1.5 flex-wrap">
            {item.tags.slice(0, 2).map(tag => (
              <Badge key={tag} color="accent" size="xs">{tag}</Badge>
            ))}
          </div>
        )}

        {item.stats?.avgRating > 0 && (
          <p className="text-xs text-textMuted mb-1.5">★ {item.stats.avgRating.toFixed(1)}</p>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="font-semibold text-text text-sm">₹{item.price}</span>
          <button
            aria-label={`Add ${item.name} to cart`}
            onClick={(e) => {
              e.stopPropagation()
              if (!kitchenOpen) return
              if (hasCustomizations) onTap(item)
              else onAdd(item)
            }}
            disabled={!kitchenOpen}
            className={[
              'w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none',
              'transition-colors',
              kitchenOpen
                ? 'bg-accent text-bg hover:brightness-110'
                : 'bg-bgElevated text-textDim cursor-not-allowed',
            ].join(' ')}
          >
            +
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Customization Bottom Sheet ────────────────────────────────────────────────
function CustomizationSheet({ item, kitchenOpen, onClose, onAdd }) {
  const [qty,          setQty]          = useState(1)
  const [selections,   setSelections]   = useState({})
  const [specialNote,  setSpecialNote]  = useState('')

  function toggleSingle(groupName, choice) {
    setSelections(prev => ({ ...prev, [groupName]: choice }))
  }

  function toggleMulti(groupName, choice) {
    setSelections(prev => {
      const current = prev[groupName] ?? []
      const next = current.includes(choice)
        ? current.filter(c => c !== choice)
        : [...current, choice]
      return { ...prev, [groupName]: next }
    })
  }

  function handleAdd() {
    const customizationList = Object.entries(selections).map(([groupName, selected]) => ({
      groupName,
      selected: Array.isArray(selected) ? selected.join(', ') : selected,
    }))
    onAdd(qty, customizationList, specialNote)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative bg-bgCard rounded-t-2xl border-t border-border max-h-[80vh] overflow-y-auto"
        role="dialog"
        aria-label={`Customize ${item.name}`}
      >
        <div className="sticky top-0 bg-bgCard px-4 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="font-display font-semibold text-text">{item.name}</h3>
            <p className="text-sm text-textMuted">₹{item.price}</p>
          </div>
          <button onClick={onClose} className="p-1 text-textMuted hover:text-text">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-5">
          {item.customizationOptions?.map(group => (
            <div key={group.groupName}>
              <p className="text-sm font-semibold text-text mb-2">
                {group.groupName}
                {group.required && <span className="text-red ml-1 text-xs">*required</span>}
              </p>
              <div className="space-y-2">
                {group.choices.map(choice => (
                  <label key={choice} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type={group.type === 'single' ? 'radio' : 'checkbox'}
                      name={group.groupName}
                      value={choice}
                      checked={
                        group.type === 'single'
                          ? selections[group.groupName] === choice
                          : (selections[group.groupName] ?? []).includes(choice)
                      }
                      onChange={() =>
                        group.type === 'single'
                          ? toggleSingle(group.groupName, choice)
                          : toggleMulti(group.groupName, choice)
                      }
                      className="accent-accent w-4 h-4"
                    />
                    <span className="text-sm text-text">{choice}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          {item.description && (
            <div>
              <p className="text-sm font-semibold text-text mb-1.5">Special note</p>
              <textarea
                value={specialNote}
                onChange={e => setSpecialNote(e.target.value)}
                placeholder="e.g. no onion, extra sauce..."
                className="w-full bg-bgElevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-textDim outline-none resize-none focus:border-accent/60"
                rows={2}
              />
            </div>
          )}

          {/* Quantity */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-text">Quantity</span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-full bg-bgElevated border border-border text-text flex items-center justify-center"
              >
                −
              </button>
              <span className="text-text font-semibold w-4 text-center">{qty}</span>
              <button
                onClick={() => setQty(q => q + 1)}
                className="w-8 h-8 rounded-full bg-accent text-bg flex items-center justify-center"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-bgCard px-4 pb-6 pt-3 border-t border-border">
          <Button
            fullWidth
            disabled={!kitchenOpen}
            onClick={handleAdd}
          >
            Add to cart — ₹{item.price * qty}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main MenuPage ─────────────────────────────────────────────────────────────
export default function MenuPage() {
  const [searchParams]  = useSearchParams()
  const hotelId         = searchParams.get('hotel')
  const tableToken      = searchParams.get('table')
  const navigate        = useNavigate()

  const [menuData,          setMenuData]          = useState(null)
  const [loading,           setLoading]           = useState(true)
  const [error,             setError]             = useState('')
  const [selectedCategory,  setSelectedCategory]  = useState('All')
  const [selectedItem,      setSelectedItem]      = useState(null)
  const [showPWABanner,     setShowPWABanner]     = useState(false)
  const [deferredPrompt,    setDeferredPrompt]    = useState(null)

  const cartItems  = useCartStore(s => s.items)
  const addItem    = useCartStore(s => s.addItem)
  const setContext = useCartStore(s => s.setContext)
  const cartCount  = cartItems.reduce((s, i) => s + i.quantity, 0)
  const cartTotal  = cartItems.reduce((s, i) => s + i.price * i.quantity, 0)
  const lastOrder = sessionStorage.getItem('lastOrder')

  // Store context
  useEffect(() => {
    if (hotelId && tableToken) {
      sessionStorage.setItem('hotelId', hotelId)
      sessionStorage.setItem('tableToken', tableToken)
      setContext(hotelId, tableToken)
    }
  }, [hotelId, tableToken, setContext])

  // Fetch menu
  useEffect(() => {
    if (!hotelId) {
      setError('Invalid QR code — hotel ID missing')
      setLoading(false)
      return
    }
    getMenu(hotelId)
      .then(data => {
        setMenuData(data)
      })
      .catch(err => {
        setError(err.response?.data?.error ?? 'Failed to load menu')
      })
      .finally(() => setLoading(false))
  }, [hotelId])

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setTimeout(() => setShowPWABanner(true), 3000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleAddToCart = useCallback((item) => {
    addItem(item, 1, [], '')
  }, [addItem])

  const handleCustomizationAdd = useCallback((qty, customizations, specialNote) => {
    if (selectedItem) {
      addItem(selectedItem, qty, customizations, specialNote)
      setSelectedItem(null)
    }
  }, [selectedItem, addItem])

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg">
        <Spinner size="xl" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-bg gap-4 px-4 text-center">
        <span className="text-4xl">⚠️</span>
        <p className="text-text font-semibold">{error}</p>
        <p className="text-textMuted text-sm">Please scan the QR code again</p>
      </div>
    )
  }

  if (!menuData) return null

  const { items = [], categories = [], hotelName, kitchenOpen } = menuData

  // Only show available items
  const visibleItems = items.filter(i => i.available)

  const filteredItems = selectedCategory === 'All'
    ? visibleItems
    : visibleItems.filter(i => i.category === selectedCategory)

  return (
    <div className="min-h-screen bg-bg pb-28">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-20 bg-bg/90 backdrop-blur-md border-b border-border px-4 py-3">
        <h1 className="font-display font-bold text-xl text-text">{hotelName}</h1>
        {!kitchenOpen && (
          <div className="flex items-center gap-1.5 mt-0.5" role="status">
            <span className="w-2 h-2 rounded-full bg-red animate-pulse" />
            <span className="text-red text-sm">Kitchen is closed — not accepting orders</span>
          </div>
        )}
      </div>

      {/* ── PWA Banner ──────────────────────────────────────────────────── */}
      {showPWABanner && (
        <div className="mx-4 mt-3 bg-bgCard border border-accent/30 rounded-xl px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text">Add to Home Screen</p>
            <p className="text-xs text-textMuted">Order faster next time</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={async () => {
                if (deferredPrompt) {
                  deferredPrompt.prompt()
                  await deferredPrompt.userChoice
                  setDeferredPrompt(null)
                }
                setShowPWABanner(false)
              }}
            >
              Install
            </Button>
            <button
              onClick={() => setShowPWABanner(false)}
              className="text-textMuted hover:text-text text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Active order banner — track + pay ───────────────────────────── */}
      {lastOrder && (() => {
        const { orderId } = JSON.parse(lastOrder)
        return (
          <div
            className="mx-4 mt-3 bg-bgCard border border-green/30 rounded-xl px-4 py-3"
            data-testid="repeat-order-banner"
          >
            <p className="text-sm font-medium text-green mb-2">You have an active order</p>
            <div className="flex gap-2">
              <button
                onClick={() => navigate('/order/' + orderId)}
                className="flex-1 py-2 bg-bgElevated border border-border rounded-lg text-xs text-textMuted hover:text-text transition-colors"
              >
                Track Order
              </button>
              <button
                onClick={() => navigate('/payment/' + orderId)}
                className="flex-1 py-2 bg-accent text-bg rounded-lg text-xs font-semibold"
              >
                Pay Bill
              </button>
            </div>
          </div>
        )
      })()}

      {/* ── Category Tabs ─────────────────────────────────────────────────── */}
      <CategoryTabs
        categories={categories}
        selected={selectedCategory}
        onChange={setSelectedCategory}
      />

      {/* ── Menu Grid ─────────────────────────────────────────────────────── */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-textMuted">No items in this category</p>
        </div>
      ) : (
        <div className="px-4 grid grid-cols-2 gap-3">
          {filteredItems.map(item => (
            <MenuItemCard
              key={item._id}
              item={item}
              kitchenOpen={!!kitchenOpen}
              onTap={setSelectedItem}
              onAdd={handleAddToCart}
            />
          ))}
        </div>
      )}

      {/* ── Floating Cart ─────────────────────────────────────────────────── */}
      {cartCount > 0 && (
        <button
          onClick={() => navigate('/cart')}
          aria-label={`View cart with ${cartCount} items`}
          className="fixed bottom-6 left-4 right-4 bg-accent text-bg font-semibold text-sm rounded-2xl px-4 py-4 flex items-center justify-between shadow-lg active:scale-98 transition-transform"
        >
          <span className="bg-bg/20 rounded-lg px-2 py-0.5 text-sm">{cartCount}</span>
          <span>View Cart</span>
          <span>₹{cartTotal}</span>
        </button>
      )}

      {/* ── Customization Sheet ───────────────────────────────────────────── */}
      {selectedItem && (
        <CustomizationSheet
          item={selectedItem}
          kitchenOpen={!!kitchenOpen}
          onClose={() => setSelectedItem(null)}
          onAdd={handleCustomizationAdd}
        />
      )}
    </div>
  )
}
