import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import KDSScreen from '../views/kds/KDSScreen'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../api/kds.api', () => ({
  getKDSOrders:  vi.fn(),
  kdsAccept:     vi.fn(),
  kdsReject:     vi.fn(),
  kdsMarkReady:  vi.fn(),
}))

const { socketHandlers, stableOn } = vi.hoisted(() => {
  const socketHandlers = {}
  const stableOn = (event, fn) => { socketHandlers[event] = fn }
  return { socketHandlers, stableOn }
})

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({ on: stableOn, emit: vi.fn(), socket: {} }),
}))

import { getKDSOrders, kdsAccept, kdsReject, kdsMarkReady } from '../api/kds.api'
import { useAuthStore } from '../stores/authStore'

// ── Fixtures ───────────────────────────────────────────────────────────────────
const KDS_USER = { _id: 'k1', name: 'Kitchen', role: 'kitchen', hotelId: 'h1' }

const ORDER_NEW = {
  _id: 'ord-001', tableNumber: 5, kdsStatus: 'new', status: 'placed',
  items: [{ name: 'Paneer Tikka', quantity: 2, customizations: [], specialNote: '' }],
  createdAt: new Date(Date.now() - 2 * 60000).toISOString(), // 2 min ago
}
const ORDER_ACCEPTING = {
  _id: 'ord-002', tableNumber: 3, kdsStatus: 'accepted', status: 'preparing',
  items: [{ name: 'Butter Chicken', quantity: 1, customizations: [], specialNote: '' }],
  createdAt: new Date(Date.now() - 7 * 60000).toISOString(), // 7 min ago
}
const ORDER_OLD = {
  _id: 'ord-003', tableNumber: 7, kdsStatus: 'new', status: 'placed',
  items: [{ name: 'Dal Makhani', quantity: 1, customizations: [], specialNote: '' }],
  createdAt: new Date(Date.now() - 12 * 60000).toISOString(), // 12 min ago — red
}

function renderKDS() {
  useAuthStore.setState({ user: KDS_USER, accessToken: 'tok', refreshToken: 'ref' })
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<KDSScreen />} />
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
describe('PF09 - KDS Screen', () => {

  test('New orders appear via socket', async () => {
    getKDSOrders.mockResolvedValueOnce({ orders: [] })
    renderKDS()

    await waitFor(() => screen.getByText('No active orders'))

    act(() => {
      socketHandlers['order:new']?.({ order: ORDER_NEW })
    })

    await waitFor(() => {
      expect(screen.getByTestId(`kds-card-${ORDER_NEW._id}`)).toBeInTheDocument()
      expect(screen.getByText(`Table ${ORDER_NEW.tableNumber}`)).toBeInTheDocument()
    })
  })

  test('Wait timer color changes at 5 and 10 min thresholds', async () => {
    getKDSOrders.mockResolvedValueOnce({ orders: [ORDER_ACCEPTING, ORDER_OLD] })
    renderKDS()

    // ORDER_ACCEPTING is 7 min old → yellow
    await waitFor(() => screen.getByTestId(`timer-${ORDER_ACCEPTING._id}`))
    expect(screen.getByTestId(`timer-${ORDER_ACCEPTING._id}`)).toHaveClass('text-yellow')

    // ORDER_OLD is 12 min old → red
    expect(screen.getByTestId(`timer-${ORDER_OLD._id}`)).toHaveClass('text-red')
  })

  test('Accept button calls PATCH /api/kds/:id/accept', async () => {
    getKDSOrders.mockResolvedValueOnce({ orders: [ORDER_NEW] })
    kdsAccept.mockResolvedValueOnce({ order: { ...ORDER_NEW, kdsStatus: 'accepted' } })
    renderKDS()

    await waitFor(() => screen.getByTestId(`accept-btn-${ORDER_NEW._id}`))
    fireEvent.click(screen.getByTestId(`accept-btn-${ORDER_NEW._id}`))

    await waitFor(() => {
      expect(kdsAccept).toHaveBeenCalledWith(ORDER_NEW._id)
    })
  })

  test('Reject shows reason modal before submitting', async () => {
    getKDSOrders.mockResolvedValueOnce({ orders: [ORDER_NEW] })
    kdsReject.mockResolvedValueOnce({ order: { ...ORDER_NEW, kdsStatus: 'rejected' } })
    renderKDS()

    await waitFor(() => screen.getByTestId(`reject-btn-${ORDER_NEW._id}`))
    fireEvent.click(screen.getByTestId(`reject-btn-${ORDER_NEW._id}`))

    // Modal appears
    expect(screen.getByTestId('kds-reject-reason')).toBeInTheDocument()

    fireEvent.change(screen.getByTestId('kds-reject-reason'), { target: { value: 'Out of stock' } })
    fireEvent.click(screen.getByTestId('confirm-reject-btn'))

    await waitFor(() => {
      expect(kdsReject).toHaveBeenCalledWith(ORDER_NEW._id, 'Out of stock')
    })
  })

  test('Mark Ready calls PATCH /api/kds/:id/ready', async () => {
    getKDSOrders.mockResolvedValueOnce({ orders: [ORDER_ACCEPTING] })
    kdsMarkReady.mockResolvedValueOnce({ order: { ...ORDER_ACCEPTING, kdsStatus: 'ready' } })
    renderKDS()

    await waitFor(() => screen.getByTestId(`ready-btn-${ORDER_ACCEPTING._id}`))
    fireEvent.click(screen.getByTestId(`ready-btn-${ORDER_ACCEPTING._id}`))

    await waitFor(() => {
      expect(kdsMarkReady).toHaveBeenCalledWith(ORDER_ACCEPTING._id)
    })
  })

  test('Rejected order disappears from board', async () => {
    getKDSOrders.mockResolvedValueOnce({ orders: [ORDER_NEW] })
    kdsReject.mockResolvedValueOnce({ order: { ...ORDER_NEW, kdsStatus: 'rejected' } })
    renderKDS()

    await waitFor(() => screen.getByTestId(`reject-btn-${ORDER_NEW._id}`))
    fireEvent.click(screen.getByTestId(`reject-btn-${ORDER_NEW._id}`))

    // Confirm rejection
    fireEvent.click(screen.getByTestId('confirm-reject-btn'))

    await waitFor(() => {
      expect(screen.queryByTestId(`kds-card-${ORDER_NEW._id}`)).not.toBeInTheDocument()
    })
  })

})
