import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Dashboard from '../views/admin/Dashboard'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../api/analytics.api', () => ({
  getDashboard: vi.fn(),
}))
vi.mock('../api/order.api', () => ({
  getLiveOrders:      vi.fn(),
  updateOrderStatus:  vi.fn(),
}))

const { socketHandlers, stableOn } = vi.hoisted(() => {
  const socketHandlers = {}
  const stableOn = (event, fn) => { socketHandlers[event] = fn }
  return { socketHandlers, stableOn }
})

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({ on: stableOn, emit: vi.fn(), socket: {} }),
}))

import { getDashboard }             from '../api/analytics.api'
import { getLiveOrders }            from '../api/order.api'
import { useAuthStore }             from '../stores/authStore'

// ── Fixtures ───────────────────────────────────────────────────────────────────
const ADMIN_USER = { _id: 'a1', name: 'Admin', role: 'admin', hotelId: 'h1' }

const DASH_DATA = {
  revenue:       { total: 12500, byDay: [] },
  orders:        { total: 42, byStatus: { served: 38, rejected: 2, cancelled: 2 } },
  avgOrderValue: 297,
  topItems:      [],
  peakHours:     [],
}
const ORDER_1 = {
  _id: 'ord-001', tableNumber: 5, status: 'placed',
  items: [{ name: 'Paneer Tikka', quantity: 2 }],
  bill: { total: 300 },
  createdAt: new Date().toISOString(),
}

function renderDashboard() {
  useAuthStore.setState({ user: ADMIN_USER, accessToken: 'tok' })
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.keys(socketHandlers).forEach(k => delete socketHandlers[k])
  useAuthStore.setState({ user: null, accessToken: null })
})

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('PF10 - Admin Dashboard', () => {

  test('Dashboard shows metric cards with revenue and active orders', async () => {
    getDashboard.mockResolvedValueOnce(DASH_DATA)
    getLiveOrders.mockResolvedValueOnce({ orders: [ORDER_1] })
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId('metric-revenue')).toBeInTheDocument()
    })
    expect(screen.getByText('₹12500')).toBeInTheDocument()
    expect(screen.getByTestId('metric-avg-order')).toBeInTheDocument()
    expect(screen.getByText('₹297')).toBeInTheDocument()
  })

  test('Live orders appear in the list', async () => {
    getDashboard.mockResolvedValueOnce(DASH_DATA)
    getLiveOrders.mockResolvedValueOnce({ orders: [ORDER_1] })
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByTestId(`live-order-${ORDER_1._id}`)).toBeInTheDocument()
    })
    expect(screen.getByText(`Table ${ORDER_1.tableNumber}`)).toBeInTheDocument()
  })

  test('Period selector fetches with correct period', async () => {
    getDashboard.mockResolvedValue(DASH_DATA)
    getLiveOrders.mockResolvedValue({ orders: [] })
    renderDashboard()

    await waitFor(() => screen.getByTestId('period-week'))
    fireEvent.click(screen.getByTestId('period-week'))

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledWith('week')
    })
  })

  test('New order via socket appears in live orders', async () => {
    getDashboard.mockResolvedValueOnce(DASH_DATA)
    getLiveOrders.mockResolvedValueOnce({ orders: [] })
    renderDashboard()

    await waitFor(() => screen.getByText('No active orders'))

    act(() => {
      socketHandlers['order:new']?.({ order: ORDER_1 })
    })

    await waitFor(() => {
      expect(screen.getByTestId(`live-order-${ORDER_1._id}`)).toBeInTheDocument()
    })
  })

  test('Served order removed from live orders via socket', async () => {
    getDashboard.mockResolvedValueOnce(DASH_DATA)
    getLiveOrders.mockResolvedValueOnce({ orders: [ORDER_1] })
    renderDashboard()

    await waitFor(() => screen.getByTestId(`live-order-${ORDER_1._id}`))

    act(() => {
      socketHandlers['order:served']?.({ orderId: ORDER_1._id })
    })

    await waitFor(() => {
      expect(screen.queryByTestId(`live-order-${ORDER_1._id}`)).not.toBeInTheDocument()
    })
  })

})
