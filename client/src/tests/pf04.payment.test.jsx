import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PaymentPage from '../views/customer/PaymentPage'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../api/payment.api', () => ({
  getPaymentByOrder: vi.fn(),
}))

const { socketHandlers, stableOn } = vi.hoisted(() => {
  const socketHandlers = {}
  const stableOn = (event, fn) => { socketHandlers[event] = fn }
  return { socketHandlers, stableOn }
})

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    on:     stableOn,
    emit:   vi.fn(),
    socket: {},
  }),
}))

import { getPaymentByOrder } from '../api/payment.api'

// ── Fixture ────────────────────────────────────────────────────────────────────
const PAYMENT_DATA = {
  payment: { _id: 'pay-001', status: 'pending' },
  bill: {
    subtotal: 440,
    cgst: 39.6,
    sgst: 39.6,
    total: 519,
    gstApplied: true,
  },
  upiDeepLinks: {
    gpay:     'gpay://upi/pay?pa=hotel@okaxis&pn=Test+Hotel&am=519&tn=Table7',
    phonepay: 'phonepe://pay?pa=hotel@okaxis&pn=Test+Hotel&am=519',
    generic:  'upi://pay?pa=hotel@okaxis&pn=Test+Hotel&am=519',
  },
  upiQrUrl: 'https://vps.example.com/uploads/upi/hotel_qr.png',
}

function renderPayment(orderId = 'ord-001') {
  return render(
    <MemoryRouter initialEntries={[`/payment/${orderId}`]}>
      <Routes>
        <Route path="/payment/:orderId" element={<PaymentPage />} />
        <Route path="/feedback/:orderId" element={<div data-testid="feedback-page" />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  Object.keys(socketHandlers).forEach(k => delete socketHandlers[k])
})

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('PF04 - Payment', () => {

  test('GPay deep link has correct format', async () => {
    getPaymentByOrder.mockResolvedValueOnce(PAYMENT_DATA)
    renderPayment()

    await waitFor(() => screen.getByTestId('gpay-link'))

    const gpay = screen.getByTestId('gpay-link')
    expect(gpay).toHaveAttribute('href', expect.stringContaining('gpay://upi/pay'))
    expect(gpay.getAttribute('href')).toContain('pa=hotel@okaxis')
    expect(gpay.getAttribute('href')).toContain('am=519')
  })

  test('PhonePe deep link has correct format', async () => {
    getPaymentByOrder.mockResolvedValueOnce(PAYMENT_DATA)
    renderPayment()

    await waitFor(() => screen.getByTestId('phonepay-link'))

    const pp = screen.getByTestId('phonepay-link')
    expect(pp).toHaveAttribute('href', expect.stringContaining('phonepe://pay'))
    expect(pp.getAttribute('href')).toContain('pa=hotel@okaxis')
  })

  test('UPI QR image displayed when scan QR button clicked', async () => {
    getPaymentByOrder.mockResolvedValueOnce(PAYMENT_DATA)
    renderPayment()

    await waitFor(() => screen.getByTestId('scan-qr-btn'))
    fireEvent.click(screen.getByTestId('scan-qr-btn'))

    const img = screen.getByTestId('upi-qr-image')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', PAYMENT_DATA.upiQrUrl)
  })

  test('payment:received socket event shows success screen', async () => {
    getPaymentByOrder.mockResolvedValueOnce(PAYMENT_DATA)
    renderPayment()

    await waitFor(() => screen.getByTestId('total-amount'))

    act(() => {
      socketHandlers['payment:received']?.({ receiptUrl: '' })
    })

    await waitFor(() => {
      expect(screen.getByTestId('payment-success')).toBeInTheDocument()
    })
  })

  test('Receipt download link appears after payment confirmed', async () => {
    getPaymentByOrder.mockResolvedValueOnce(PAYMENT_DATA)
    renderPayment()

    await waitFor(() => screen.getByTestId('total-amount'))

    act(() => {
      socketHandlers['payment:received']?.({
        receiptUrl: 'https://vps.example.com/uploads/receipts/ord-001.pdf',
      })
    })

    await waitFor(() => {
      const link = screen.getByTestId('receipt-link')
      expect(link).toBeInTheDocument()
      expect(link).toHaveAttribute('href', 'https://vps.example.com/uploads/receipts/ord-001.pdf')
    })
  })

})
