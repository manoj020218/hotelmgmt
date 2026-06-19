import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import FeedbackPage from '../views/customer/FeedbackPage'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../api/feedback.api', () => ({
  submitFeedback: vi.fn(),
}))

import { submitFeedback } from '../api/feedback.api'

// ── Helpers ────────────────────────────────────────────────────────────────────
function renderFeedback(orderId = 'ord-001') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/feedback/${orderId}`, state: { sessionId: 'sess-001' } }]}>
      <Routes>
        <Route path="/feedback/:orderId" element={<FeedbackPage />} />
        <Route path="/menu"              element={<div data-testid="menu-page" />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
})

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('PF05 - Feedback', () => {

  test('Star rating selection works for all categories', () => {
    renderFeedback()

    // Click 4 stars for Food
    fireEvent.click(screen.getByLabelText('Food 4 star'))
    // Click 5 stars for Overall
    fireEvent.click(screen.getByLabelText('Overall 5 star'))
    // Click 3 stars for Waiter
    fireEvent.click(screen.getByLabelText('Waiter 3 star'))

    // Button enabled and stars selected — no error state
    expect(screen.queryByTestId('feedback-error')).not.toBeInTheDocument()
  })

  test('Submit without overall rating shows validation error', () => {
    renderFeedback()

    fireEvent.click(screen.getByTestId('submit-btn'))

    expect(screen.getByTestId('feedback-error')).toBeInTheDocument()
    expect(screen.getByTestId('feedback-error').textContent).toContain('overall')
    expect(submitFeedback).not.toHaveBeenCalled()
  })

  test('Submit with ratings calls API with correct payload', async () => {
    submitFeedback.mockResolvedValueOnce({ feedback: { _id: 'fb-001' } })
    renderFeedback()

    // Rate overall to pass validation
    fireEvent.click(screen.getByLabelText('Overall 5 star'))
    fireEvent.click(screen.getByLabelText('Food 4 star'))
    fireEvent.change(screen.getByTestId('comment-input'), { target: { value: 'Great food!' } })

    fireEvent.click(screen.getByTestId('submit-btn'))

    await waitFor(() => {
      expect(submitFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId:  'ord-001',
          sessionId: 'sess-001',
          ratings:  expect.objectContaining({ overall: 5, food: 4 }),
          comment:  'Great food!',
        })
      )
    })
  })

  test('Thank you screen shown after successful submission', async () => {
    submitFeedback.mockResolvedValueOnce({ feedback: { _id: 'fb-001' } })
    renderFeedback()

    fireEvent.click(screen.getByLabelText('Overall 5 star'))
    fireEvent.click(screen.getByTestId('submit-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('thank-you')).toBeInTheDocument()
    })
  })

  test('Skip button navigates to menu', () => {
    renderFeedback()

    fireEvent.click(screen.getByTestId('skip-btn'))

    expect(screen.getByTestId('menu-page')).toBeInTheDocument()
  })

})
