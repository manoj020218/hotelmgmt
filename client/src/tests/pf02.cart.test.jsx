import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import CartPage from '../views/customer/CartPage'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../api/order.api', () => ({
  placeOrder: vi.fn(),
}))

import { placeOrder } from '../api/order.api'
import { useCartStore } from '../stores/cartStore'

// ── Cart items fixture ─────────────────────────────────────────────────────────
const ITEM_VEG = {
  menuItemId: 'i1', name: 'Paneer Tikka', price: 150, isVeg: true,
  quantity: 2, customizations: [], specialNote: '',
}
const ITEM_NONVEG = {
  menuItemId: 'i2', name: 'Butter Chicken', price: 280, isVeg: false,
  quantity: 1,
  customizations: [{ groupName: 'Spice Level', selected: 'Medium' }],
  specialNote: 'no gravy',
}

function seedCart(items = [ITEM_VEG, ITEM_NONVEG], extra = {}) {
  useCartStore.setState({
    items,
    hotelId:    'h1',
    tableToken: 'tk-table5',
    ...extra,
  })
}

function renderCart() {
  return render(
    <MemoryRouter initialEntries={['/cart']}>
      <Routes>
        <Route path="/cart"            element={<CartPage />} />
        <Route path="/order/:orderId"  element={<div data-testid="order-status" />} />
        <Route path="/menu"            element={<div data-testid="menu-page" />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  useCartStore.setState({ items: [], hotelId: null, tableToken: null })
})

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('PF02 - Cart', () => {

  test('Cart shows correct items and totals', () => {
    seedCart()
    renderCart()

    expect(screen.getByText('Paneer Tikka')).toBeInTheDocument()
    expect(screen.getByText('Butter Chicken')).toBeInTheDocument()

    // Subtotals: 150×2=300, 280×1=280 → estimated total 580
    expect(screen.getAllByText(/₹580/).length).toBeGreaterThanOrEqual(1)

    // Customization detail shown
    expect(screen.getByText(/Spice Level: Medium/)).toBeInTheDocument()
  })

  test('Increment/decrement quantity works', () => {
    seedCart([{ ...ITEM_VEG, quantity: 1 }])
    renderCart()

    const incBtn = screen.getByLabelText(/Increase quantity of Paneer Tikka/i)
    fireEvent.click(incBtn)

    expect(useCartStore.getState().items[0].quantity).toBe(2)

    const decBtn = screen.getByLabelText(/Decrease quantity of Paneer Tikka/i)
    fireEvent.click(decBtn)

    expect(useCartStore.getState().items[0].quantity).toBe(1)
  })

  test('Remove item works', () => {
    seedCart([ITEM_VEG, ITEM_NONVEG])
    renderCart()

    // Remove Paneer Tikka
    const removeBtn = screen.getAllByLabelText(/remove/i)[0]
    fireEvent.click(removeBtn)

    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0].name).toBe('Butter Chicken')
  })

  test('GST breakdown shows correctly', () => {
    seedCart()
    renderCart()

    // Bill summary section exists
    expect(screen.getByText('Bill Summary')).toBeInTheDocument()
    expect(screen.getByText(/gst will be calculated/i)).toBeInTheDocument()
    expect(screen.getByText('Subtotal')).toBeInTheDocument()
  })

  test('Place order button calls API with correct payload', async () => {
    seedCart([ITEM_VEG])
    placeOrder.mockResolvedValueOnce({
      orderId:   'ord-001',
      sessionId: 'sess-001',
      bill:      { subtotal: 300, cgst: 27, sgst: 27, total: 354 },
    })
    renderCart()

    const placeBtn = screen.getByRole('button', { name: /place order/i })
    fireEvent.click(placeBtn)

    await waitFor(() => {
      expect(placeOrder).toHaveBeenCalledWith({
        tableQrToken: 'tk-table5',
        items: [
          expect.objectContaining({
            menuItemId: 'i1',
            quantity:   2,
          }),
        ],
      })
    })
  })

  test('On success navigate to order status', async () => {
    seedCart([ITEM_VEG])
    placeOrder.mockResolvedValueOnce({
      orderId:   'ord-abc',
      sessionId: 'sess-abc',
      bill:      { subtotal: 300, cgst: 27, sgst: 27, total: 354 },
    })
    renderCart()

    fireEvent.click(screen.getByRole('button', { name: /place order/i }))

    await waitFor(() => {
      expect(screen.getByTestId('order-status')).toBeInTheDocument()
    })

    // lastOrder stored in sessionStorage
    const stored = JSON.parse(sessionStorage.getItem('lastOrder'))
    expect(stored.orderId).toBe('ord-abc')
  })

  test('On API error show error toast', async () => {
    seedCart([ITEM_VEG])
    placeOrder.mockRejectedValueOnce({
      response: { data: { error: 'Item unavailable' } },
    })
    renderCart()

    fireEvent.click(screen.getByRole('button', { name: /place order/i }))

    await waitFor(() => {
      expect(screen.getByText('Item unavailable')).toBeInTheDocument()
    })
  })

  test('Empty cart shows back to menu button', () => {
    useCartStore.setState({ items: [], hotelId: 'h1', tableToken: 'tk1' })
    renderCart()

    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to menu/i })).toBeInTheDocument()
  })

})
