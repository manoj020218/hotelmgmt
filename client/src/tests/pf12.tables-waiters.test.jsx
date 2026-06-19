import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import TableManager from '../views/admin/TableManager'
import WaiterManager from '../views/admin/WaiterManager'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../api/table.api', () => ({
  getAdminTables:    vi.fn(),
  createTable:       vi.fn(),
  updateTableStatus: vi.fn(),
  getTableQR:        vi.fn(),
}))
vi.mock('../api/waiter.api', () => ({
  getAllWaiters:  vi.fn(),
  createWaiter:  vi.fn(),
  deleteWaiter:  vi.fn(),
  updateWaiter:  vi.fn(),
  toggleAvailability: vi.fn(),
  getMyWaiterProfile: vi.fn(),
}))

import { getAdminTables, createTable, updateTableStatus, getTableQR } from '../api/table.api'
import { getAllWaiters, createWaiter, deleteWaiter }                  from '../api/waiter.api'

// ── Fixtures ───────────────────────────────────────────────────────────────────
const TABLES = [
  { _id: 't1', tableNumber: 1, capacity: 4, status: 'available', notes: [] },
  { _id: 't2', tableNumber: 2, capacity: 2, status: 'occupied',  notes: [{ text: 'VIP', tag: 'VIP' }] },
]
const WAITERS = [
  { _id: 'w1', name: 'Rahul', phone: '9999', role: 'waiter', isActive: true,  stats: { avgRating: 4.5 } },
  { _id: 'w2', name: 'Priya', phone: '8888', role: 'kitchen', isActive: false, stats: { avgRating: 4.2 } },
]

function renderTM() {
  return render(<MemoryRouter><Routes><Route path="/" element={<TableManager />} /></Routes></MemoryRouter>)
}
function renderWM() {
  return render(<MemoryRouter><Routes><Route path="/" element={<WaiterManager />} /></Routes></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('PF12 - Tables & Waiters', () => {

  test('Tables grid renders all tables', async () => {
    getAdminTables.mockResolvedValueOnce({ tables: TABLES })
    renderTM()

    await waitFor(() => {
      expect(screen.getByTestId('table-card-t1')).toBeInTheDocument()
      expect(screen.getByTestId('table-card-t2')).toBeInTheDocument()
    })
    expect(screen.getByText('T1')).toBeInTheDocument()
    expect(screen.getByText('T2')).toBeInTheDocument()
  })

  test('Table status change calls API', async () => {
    getAdminTables.mockResolvedValueOnce({ tables: TABLES })
    updateTableStatus.mockResolvedValueOnce({ table: { ...TABLES[0], status: 'occupied' } })
    renderTM()

    await waitFor(() => screen.getByTestId('status-select-t1'))
    fireEvent.change(screen.getByTestId('status-select-t1'), { target: { value: 'occupied' } })

    await waitFor(() => {
      expect(updateTableStatus).toHaveBeenCalledWith('t1', { status: 'occupied' })
    })
  })

  test('Table QR download calls API', async () => {
    getAdminTables.mockResolvedValueOnce({ tables: TABLES })
    getTableQR.mockResolvedValueOnce({ qrCodeUrl: 'https://vps.example.com/qr/t1.png' })
    // Mock window.open
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => {})
    renderTM()

    await waitFor(() => screen.getByTestId('qr-btn-t1'))
    fireEvent.click(screen.getByTestId('qr-btn-t1'))

    await waitFor(() => {
      expect(getTableQR).toHaveBeenCalledWith('t1')
    })
    openSpy.mockRestore()
  })

  test('Waiters list renders all staff', async () => {
    getAllWaiters.mockResolvedValueOnce({ waiters: WAITERS })
    renderWM()

    await waitFor(() => {
      expect(screen.getByTestId('waiter-row-w1')).toBeInTheDocument()
      expect(screen.getByTestId('waiter-row-w2')).toBeInTheDocument()
    })
    expect(screen.getByText('Rahul')).toBeInTheDocument()
    expect(screen.getByText('Priya')).toBeInTheDocument()
  })

  test('Inactive waiter shows inactive label', async () => {
    getAllWaiters.mockResolvedValueOnce({ waiters: WAITERS })
    renderWM()

    await waitFor(() => screen.getByTestId('waiter-row-w2'))
    expect(screen.getByText('Inactive')).toBeInTheDocument()
    // Deactivate button not shown for already inactive waiter
    expect(screen.queryByTestId('deactivate-w2')).not.toBeInTheDocument()
  })

  test('Add Staff modal opens and validates required fields', async () => {
    getAllWaiters.mockResolvedValueOnce({ waiters: [] })
    renderWM()

    await waitFor(() => screen.getByTestId('add-staff-btn'))
    fireEvent.click(screen.getByTestId('add-staff-btn'))

    expect(screen.getByTestId('add-waiter-modal')).toBeInTheDocument()

    // Try to save without fields
    fireEvent.click(screen.getByTestId('save-waiter-btn'))
    expect(screen.getByTestId('waiter-modal-error')).toBeInTheDocument()
    expect(createWaiter).not.toHaveBeenCalled()
  })

})
