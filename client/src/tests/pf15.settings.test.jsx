import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Settings from '../views/admin/Settings'

vi.mock('../api/settings.api', () => ({
  getSettings:      vi.fn(),
  updateHotelInfo:  vi.fn(),
  updateGST:        vi.fn(),
  updateOperations: vi.fn(),
  updateKitchen:    vi.fn(),
  updatePayment:    vi.fn(),
  uploadUpiQr:      vi.fn(),
}))

import {
  getSettings, updateHotelInfo, updateGST,
  updateOperations, updateKitchen, updatePayment,
} from '../api/settings.api'

const HOTEL = {
  name: 'Test Hotel',
  address: '123 Main St',
  phone: '+91 9876543210',
  gstin: '',
  gstEnabled: false,
  cgstPercent: 9,
  sgstPercent: 9,
  upiId: 'hotel@okaxis',
  upiQrUrl: '',
  settings: {
    kdsEnabled: true,
    tableVisibilityPublic: false,
    autoWaiterAssign: true,
    orderModificationWindow: 5,
    kitchenOpen: true,
    kitchenOpenTime: '10:00',
    kitchenCloseTime: '23:00',
    receiptFlow: 'customer',
  },
}

function renderPage() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<Settings />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => vi.clearAllMocks())

describe('PF15 - Admin Settings', () => {

  test('Settings page loads and shows hotel info fields', async () => {
    getSettings.mockResolvedValueOnce({ hotel: HOTEL })
    renderPage()

    const nameInput = await screen.findByTestId('hotel-name')
    expect(nameInput.value).toBe('Test Hotel')
    expect(screen.getByTestId('upi-id-input').value).toBe('hotel@okaxis')
  })

  test('Save hotel info calls updateHotelInfo API', async () => {
    getSettings.mockResolvedValueOnce({ hotel: HOTEL })
    updateHotelInfo.mockResolvedValueOnce({ hotel: { ...HOTEL, name: 'New Name' } })
    renderPage()

    await screen.findByTestId('hotel-name')
    fireEvent.change(screen.getByTestId('hotel-name'), { target: { value: 'New Name' } })
    fireEvent.click(screen.getByTestId('save-info-btn'))

    await waitFor(() => {
      expect(updateHotelInfo).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Name' }))
    })
  })

  test('GST toggle shows CGST/SGST fields when enabled', async () => {
    getSettings.mockResolvedValueOnce({ hotel: HOTEL })
    renderPage()

    await screen.findByTestId('gst-toggle')
    expect(screen.queryByTestId('cgst-input')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('gst-toggle'))
    expect(screen.getByTestId('cgst-input')).toBeInTheDocument()
    expect(screen.getByTestId('sgst-input')).toBeInTheDocument()
  })

  test('Save GST calls updateGST API', async () => {
    getSettings.mockResolvedValueOnce({ hotel: HOTEL })
    updateGST.mockResolvedValueOnce({ hotel: HOTEL })
    renderPage()

    await screen.findByTestId('save-gst-btn')
    fireEvent.click(screen.getByTestId('save-gst-btn'))

    await waitFor(() => {
      expect(updateGST).toHaveBeenCalledWith(expect.objectContaining({ gstEnabled: false }))
    })
  })

  test('Operations toggles save correctly', async () => {
    getSettings.mockResolvedValueOnce({ hotel: HOTEL })
    updateOperations.mockResolvedValueOnce({ hotel: HOTEL })
    renderPage()

    await screen.findByTestId('kds-toggle')
    fireEvent.click(screen.getByTestId('kds-toggle'))
    fireEvent.click(screen.getByTestId('save-ops-btn'))

    await waitFor(() => {
      expect(updateOperations).toHaveBeenCalledWith(expect.objectContaining({ kdsEnabled: false }))
    })
  })

  test('Kitchen hours save calls updateKitchen API', async () => {
    getSettings.mockResolvedValueOnce({ hotel: HOTEL })
    updateKitchen.mockResolvedValueOnce({ hotel: HOTEL })
    renderPage()

    await screen.findByTestId('open-time-input')
    fireEvent.change(screen.getByTestId('open-time-input'), { target: { value: '09:00' } })
    fireEvent.click(screen.getByTestId('save-kitchen-btn'))

    await waitFor(() => {
      expect(updateKitchen).toHaveBeenCalledWith(expect.objectContaining({ kitchenOpenTime: '09:00' }))
    })
  })

})
