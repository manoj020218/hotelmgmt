import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import WaiterApp from '../views/waiter/WaiterApp'
import WaiterLogin from '../views/auth/WaiterLogin'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../api/order.api', () => ({
  getMyOrders:       vi.fn(),
  updateOrderStatus: vi.fn(),
}))
vi.mock('../api/waiter.api', () => ({
  toggleAvailability: vi.fn(),
}))

const { socketHandlers, stableOn } = vi.hoisted(() => {
  const socketHandlers = {}
  const stableOn = (event, fn) => { socketHandlers[event] = fn }
  return { socketHandlers, stableOn }
})

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({ on: stableOn, emit: vi.fn(), socket: {} }),
}))

vi.mock('../api/axios', () => ({
  default: {
    post: vi.fn(),
    get:  vi.fn(),
  },
}))

import { getMyOrders, updateOrderStatus } from '../api/order.api'
import { toggleAvailability }             from '../api/waiter.api'
import api                                from '../api/axios'
import { useAuthStore }                   from '../stores/authStore'

// ── Fixtures ───────────────────────────────────────────────────────────────────
const WAITER_USER = {
  _id: 'w1', name: 'Rahul', role: 'waiter', hotelId: 'h1',
  stats: { avgRating: 4.5, ratingCount: 10, totalServed: 45 },
}
const ORDER_1 = {
  _id: 'ord-001', tableNumber: 5, status: 'assigned',
  items: [{ name: 'Paneer Tikka', quantity: 2, customizations: [], specialNote: '' }],
  bill: { total: 300 },
  createdAt: new Date().toISOString(),
}

function renderWaiterApp() {
  useAuthStore.setState({ user: WAITER_USER, accessToken: 'tok', refreshToken: 'ref' })
  return render(
    <MemoryRouter initialEntries={['/waiter']}>
      <Routes>
        <Route path="/waiter/*" element={<WaiterApp />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.keys(socketHandlers).forEach(k => delete socketHandlers[k])
  useAuthStore.setState({ user: null, accessToken: null, refreshToken: null })
})

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('PF07 - Waiter App', () => {

  test('PIN login with correct PIN succeeds', async () => {
    api.post.mockResolvedValueOnce({
      data: { user: WAITER_USER, accessToken: 'tok', refreshToken: 'ref' },
    })
    render(
      <MemoryRouter initialEntries={['/waiter/login']}>
        <Routes>
          <Route path="/waiter/login" element={<WaiterLogin />} />
          <Route path="/waiter/*"     element={<div data-testid="waiter-app" />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText(/provided by your manager/i), { target: { value: 'hotel-id-1' } })
    fireEvent.change(screen.getByPlaceholderText(/pin/i),   { target: { value: '1234' } })
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'))

    await waitFor(() => {
      expect(screen.getByTestId('waiter-app')).toBeInTheDocument()
    })
  })

  test('PIN login with wrong PIN shows error', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { error: 'Invalid PIN' } } })
    render(
      <MemoryRouter initialEntries={['/waiter/login']}>
        <Routes>
          <Route path="/waiter/login" element={<WaiterLogin />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByPlaceholderText(/provided by your manager/i), { target: { value: 'hotel-id-1' } })
    fireEvent.change(screen.getByPlaceholderText(/pin/i),   { target: { value: '0000' } })
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'))

    await waitFor(() => {
      expect(screen.getByText('Invalid PIN')).toBeInTheDocument()
    })
  })

  test('Assigned orders appear in My Orders', async () => {
    getMyOrders.mockResolvedValueOnce({ orders: [ORDER_1] })
    renderWaiterApp()

    await waitFor(() => {
      expect(screen.getByText(`Table ${ORDER_1.tableNumber}`)).toBeInTheDocument()
    })
    expect(screen.getByText(/Paneer Tikka/)).toBeInTheDocument()
  })

  test('Mark served calls correct API endpoint', async () => {
    getMyOrders.mockResolvedValueOnce({ orders: [ORDER_1] })
    updateOrderStatus.mockResolvedValueOnce({ order: { ...ORDER_1, status: 'served' } })
    renderWaiterApp()

    await waitFor(() => screen.getByTestId(`serve-btn-${ORDER_1._id}`))
    fireEvent.click(screen.getByTestId(`serve-btn-${ORDER_1._id}`))

    await waitFor(() => {
      expect(updateOrderStatus).toHaveBeenCalledWith(ORDER_1._id, 'served')
    })
  })

  test('Toggle availability calls API', async () => {
    getMyOrders.mockResolvedValueOnce({ orders: [] })
    toggleAvailability.mockResolvedValueOnce({ user: { ...WAITER_USER, available: false } })
    renderWaiterApp()

    await waitFor(() => screen.getByTestId('availability-toggle'))
    fireEvent.click(screen.getByTestId('availability-toggle'))

    await waitFor(() => {
      expect(toggleAvailability).toHaveBeenCalledWith(false)
    })
  })

  test('order:ready event highlights order card', async () => {
    getMyOrders.mockResolvedValueOnce({ orders: [ORDER_1] })
    renderWaiterApp()

    await waitFor(() => screen.getByTestId(`order-card-${ORDER_1._id}`))

    act(() => {
      socketHandlers['order:ready']?.({ orderId: ORDER_1._id })
    })

    await waitFor(() => {
      expect(screen.getByTestId('ready-highlight')).toBeInTheDocument()
    })
  })

})
