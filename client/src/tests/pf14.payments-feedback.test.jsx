import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Payments from '../views/admin/Payments'
import Feedback from '../views/admin/Feedback'

vi.mock('../api/payment.api', () => ({
  getTodayPayments:    vi.fn(),
  markPaymentReceived: vi.fn(),
}))
vi.mock('../api/feedback.api', () => ({
  submitFeedback:    vi.fn(),
  getAdminFeedback:  vi.fn(),
  getWaiterFeedback: vi.fn(),
}))

import { getTodayPayments, markPaymentReceived } from '../api/payment.api'
import { getAdminFeedback }                      from '../api/feedback.api'

const PAYMENTS_DATA = {
  payments:       [{ _id: 'pay-001', tableNumber: 5, amount: 519, method: 'upi', status: 'received', receiptUrl: '' }],
  totalCollected: 519,
  byMethod:       { upi: 519 },
  pending:        [{ _id: 'pay-002', tableNumber: 7, amount: 300 }],
}

const FEEDBACK_DATA = {
  feedbacks: [
    { _id: 'fb-001', ratings: { waiter: 5, food: 4, overall: 4 }, comment: 'Great service', submittedAt: new Date().toISOString() },
  ],
  avgRatings:        { waiter: 4.5, food: 4.2, overall: 4.3 },
  waiterLeaderboard: [{ _id: 'w1', name: 'Rahul', avgRating: 4.7, ratingCount: 20 }],
}

function renderPage(Component) {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Component />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('PF14 - Admin Payments & Feedback', () => {

  test('Payments shows today collections total', async () => {
    getTodayPayments.mockResolvedValueOnce(PAYMENTS_DATA)
    renderPage(Payments)

    const card = await screen.findByTestId('total-collected')
    expect(within(card).getByText('₹519')).toBeInTheDocument()
  })

  test('Pending payments show mark received buttons', async () => {
    getTodayPayments.mockResolvedValueOnce(PAYMENTS_DATA)
    renderPage(Payments)

    await waitFor(() => {
      expect(screen.getByTestId('pending-pay-002')).toBeInTheDocument()
    })
    expect(screen.getByTestId('mark-cash-pay-002')).toBeInTheDocument()
    expect(screen.getByTestId('mark-upi-pay-002')).toBeInTheDocument()
  })

  test('Mark received calls API and removes from pending', async () => {
    getTodayPayments.mockResolvedValueOnce(PAYMENTS_DATA)
    markPaymentReceived.mockResolvedValueOnce({
      payment: { _id: 'pay-002', tableNumber: 7, amount: 300, method: 'cash', status: 'received' },
    })
    renderPage(Payments)

    await waitFor(() => screen.getByTestId('mark-cash-pay-002'))
    fireEvent.click(screen.getByTestId('mark-cash-pay-002'))

    await waitFor(() => {
      expect(markPaymentReceived).toHaveBeenCalledWith('pay-002', { method: 'cash' })
      expect(screen.queryByTestId('pending-pay-002')).not.toBeInTheDocument()
    })
  })

  test('Feedback shows average ratings for waiter/food/overall', async () => {
    getAdminFeedback.mockResolvedValueOnce(FEEDBACK_DATA)
    renderPage(Feedback)

    await waitFor(() => {
      expect(screen.getByTestId('avg-waiter')).toBeInTheDocument()
      expect(screen.getByTestId('avg-food')).toBeInTheDocument()
      expect(screen.getByTestId('avg-overall')).toBeInTheDocument()
    })
    expect(screen.getByText('4.5')).toBeInTheDocument()
  })

  test('Feedback shows waiter leaderboard', async () => {
    getAdminFeedback.mockResolvedValueOnce(FEEDBACK_DATA)
    renderPage(Feedback)

    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-w1')).toBeInTheDocument()
    })
    expect(screen.getByText('Rahul')).toBeInTheDocument()
  })

})
