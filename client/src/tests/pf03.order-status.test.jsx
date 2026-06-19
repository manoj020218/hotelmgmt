import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import OrderStatusPage from '../views/customer/OrderStatusPage'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../api/order.api', () => ({
  getOrder: vi.fn(),
  modifyOrder: vi.fn(),
}))

// Mock useSocket with a controllable event emitter
let socketHandlers = {}
vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    on: (event, fn) => { socketHandlers[event] = fn },
    emit: vi.fn(),
    socket: {},
  }),
}))

import { getOrder } from '../api/order.api'

// ── Fixture ────────────────────────────────────────────────────────────────────
const ORDER = {
  _id:           'ord-001',
  hotelId:       'h1',
  tableNumber:   5,
  sessionId:     'sess-001',
  status:        'placed',
  kdsStatus:     'new',
  assignedWaiterId: null,
  items: [
    { _id: 'oi1', name: 'Paneer Tikka', price: 150, quantity: 2, customizations: [] },
  ],
  bill: { subtotal: 300, cgst: 27, sgst: 27, total: 354, gstApplied: true },
  createdAt: new Date().toISOString(),
}

function renderOrder(orderId = 'ord-001', state = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/order/${orderId}`, state: { sessionId: 'sess-001', ...state } }]}>
      <Routes>
        <Route path="/order/:orderId"   element={<OrderStatusPage />} />
        <Route path="/payment/:orderId" element={<div data-testid="payment-page" />} />
        <Route path="/menu"             element={<div data-testid="menu-page" />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  socketHandlers = {}
  sessionStorage.clear()
})

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('PF03 - Order Status', () => {

  test('Progress tracker advances on socket events', async () => {
    getOrder.mockResolvedValueOnce({ order: { ...ORDER } })
    renderOrder()

    await waitFor(() => screen.getByTestId('progress-tracker'))

    // Initially at step 0 (Placed)
    expect(screen.getByTestId('progress-tracker')).toBeInTheDocument()

    // Simulate order:kds_accepted socket → status becomes preparing
    act(() => {
      socketHandlers['order:kds_accepted']?.()
    })

    await waitFor(() => {
      // Step 2 (Preparing) should be active now
      const tracker = screen.getByTestId('progress-tracker')
      expect(tracker).toBeInTheDocument()
    })
  })

  test('Waiter assignment card appears on order:assigned', async () => {
    getOrder.mockResolvedValueOnce({ order: { ...ORDER } })
    renderOrder()

    await waitFor(() => screen.getByTestId('progress-tracker'))

    // No waiter card yet
    expect(screen.queryByTestId('waiter-assignment')).not.toBeInTheDocument()

    // Simulate order:assigned socket
    act(() => {
      socketHandlers['order:assigned']?.({ waiterId: 'w1', waiterName: 'Rahul' })
    })

    await waitFor(() => {
      expect(screen.getByTestId('waiter-assignment')).toBeInTheDocument()
      expect(screen.getByText('Rahul')).toBeInTheDocument()
    })
  })

  test('Add items button disabled after KDS accepts', async () => {
    getOrder.mockResolvedValueOnce({ order: { ...ORDER, status: 'placed' } })
    renderOrder()

    await waitFor(() => screen.getByTestId('progress-tracker'))

    // Add items button visible before KDS accepts
    expect(screen.getByTestId('add-items-btn')).toBeInTheDocument()

    // KDS accepts → status goes to preparing
    act(() => {
      socketHandlers['order:kds_accepted']?.()
    })

    await waitFor(() => {
      // Once preparing, add items button should disappear
      expect(screen.queryByTestId('add-items-btn')).not.toBeInTheDocument()
    })
  })

  test('Pay button appears on order:served event', async () => {
    getOrder.mockResolvedValueOnce({ order: { ...ORDER } })
    renderOrder()

    await waitFor(() => screen.getByTestId('progress-tracker'))

    // No pay button initially
    expect(screen.queryByTestId('pay-button')).not.toBeInTheDocument()

    // Simulate order:served
    act(() => {
      socketHandlers['order:served']?.()
    })

    await waitFor(() => {
      expect(screen.getByTestId('pay-button')).toBeInTheDocument()
    })
  })

  test('Rejection notice shown on kds_rejected', async () => {
    getOrder.mockResolvedValueOnce({ order: { ...ORDER } })
    renderOrder()

    await waitFor(() => screen.getByTestId('progress-tracker'))

    // No rejection notice yet
    expect(screen.queryByTestId('rejection-notice')).not.toBeInTheDocument()

    // Simulate kds_rejected
    act(() => {
      socketHandlers['order:kds_rejected']?.({ reason: 'Out of stock' })
    })

    await waitFor(() => {
      expect(screen.getByTestId('rejection-notice')).toBeInTheDocument()
      expect(screen.getByText(/Out of stock/)).toBeInTheDocument()
    })
  })

})
