import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Analytics from '../views/admin/Analytics'

vi.mock('../api/analytics.api', () => ({
  getDashboard: vi.fn(),
  getRevenue:   vi.fn(),
  getTopItems:  vi.fn(),
  exportCSV:    vi.fn(),
}))

import { getDashboard, getRevenue, getTopItems, exportCSV } from '../api/analytics.api'

const DASH = {
  revenue:      { total: 25000, byDay: [] },
  orders:       { total: 85, byStatus: { served: 80, rejected: 3, cancelled: 2 } },
  avgOrderValue: 294,
  paymentMethods: { cash: 40, upi: 55, card: 5 },
  waiterPerformance: [
    { name: 'Rahul', served: 30, avgRating: 4.7 },
    { name: 'Priya', served: 50, avgRating: 4.5 },
  ],
}
const REVENUE = { data: [{ _id: '2026-06-01', revenue: 5000 }, { _id: '2026-06-02', revenue: 8000 }] }
const TOP_ITEMS = { items: [{ name: 'Paneer Tikka', revenue: 12000, orders: 40 }] }

function setup(dashOverride = {}) {
  getDashboard.mockResolvedValue({ ...DASH, ...dashOverride })
  getRevenue.mockResolvedValue(REVENUE)
  getTopItems.mockResolvedValue(TOP_ITEMS)
}

function renderAnalytics() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Analytics />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('PF13 - Analytics', () => {

  test('Summary cards show correct revenue and order counts', async () => {
    setup()
    renderAnalytics()

    await waitFor(() => {
      expect(screen.getByTestId('stat-revenue')).toBeInTheDocument()
    })
    expect(screen.getByText('₹25000')).toBeInTheDocument()
    expect(screen.getByText('85')).toBeInTheDocument()
  })

  test('Top items chart renders item names', async () => {
    setup()
    renderAnalytics()

    await waitFor(() => {
      expect(screen.getByText('Paneer Tikka')).toBeInTheDocument()
    })
  })

  test('Period selector triggers re-fetch with correct period', async () => {
    setup()
    renderAnalytics()

    await waitFor(() => screen.getByTestId('period-month'))
    fireEvent.click(screen.getByTestId('period-month'))

    await waitFor(() => {
      expect(getDashboard).toHaveBeenCalledWith('month')
    })
  })

  test('Payment methods section shows percentages', async () => {
    setup()
    renderAnalytics()

    await waitFor(() => {
      expect(screen.getByText('55%')).toBeInTheDocument() // UPI
      expect(screen.getByText('40%')).toBeInTheDocument() // Cash
    })
  })

  test('CSV export button calls exportCSV', async () => {
    setup()
    const mockBlob = new Blob(['csv'], { type: 'text/csv' })
    exportCSV.mockResolvedValueOnce(mockBlob)
    // Mock URL.createObjectURL
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
    renderAnalytics()

    await waitFor(() => screen.getByTestId('export-csv-btn'))
    fireEvent.click(screen.getByTestId('export-csv-btn'))

    await waitFor(() => {
      expect(exportCSV).toHaveBeenCalledWith({ period: 'week' })
    })
  })

})
