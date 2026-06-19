import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MenuManager from '../views/admin/MenuManager'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../api/menu.api', () => ({
  getMenuAdmin:       vi.fn(),
  createMenuItem:     vi.fn(),
  updateMenuItem:     vi.fn(),
  toggleAvailability: vi.fn(),
  deleteMenuItem:     vi.fn(),
}))

import {
  getMenuAdmin, createMenuItem, toggleAvailability, deleteMenuItem,
} from '../api/menu.api'

// ── Fixtures ───────────────────────────────────────────────────────────────────
const ITEMS = [
  {
    _id: 'item-001', name: 'Paneer Tikka', category: 'Starters',
    price: 150, isVeg: true, available: true, photoUrl: null,
    customizationOptions: [{ groupName: 'Spice', type: 'single', required: false, choices: ['Mild', 'Hot'] }],
  },
  {
    _id: 'item-002', name: 'Butter Chicken', category: 'Mains',
    price: 280, isVeg: false, available: false, photoUrl: null,
    customizationOptions: [],
  },
]

function renderMM() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<MenuManager />} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('PF11 - Menu Manager', () => {

  test('Renders all menu items from API', async () => {
    getMenuAdmin.mockResolvedValueOnce({ items: ITEMS })
    renderMM()

    await waitFor(() => {
      expect(screen.getByTestId('item-card-item-001')).toBeInTheDocument()
      expect(screen.getByTestId('item-card-item-002')).toBeInTheDocument()
    })
    expect(screen.getByText('Paneer Tikka')).toBeInTheDocument()
    expect(screen.getByText('Butter Chicken')).toBeInTheDocument()
  })

  test('Category filter shows correct items', async () => {
    getMenuAdmin.mockResolvedValueOnce({ items: ITEMS })
    renderMM()

    await waitFor(() => screen.getByText('Paneer Tikka'))

    // Filter to Mains — click the filter button (not the category label inside the card)
    fireEvent.click(screen.getAllByText('Mains')[0])

    expect(screen.queryByText('Paneer Tikka')).not.toBeInTheDocument()
    expect(screen.getByText('Butter Chicken')).toBeInTheDocument()
  })

  test('Toggle availability calls API', async () => {
    getMenuAdmin.mockResolvedValueOnce({ items: ITEMS })
    toggleAvailability.mockResolvedValueOnce({ item: { ...ITEMS[0], available: false } })
    renderMM()

    await waitFor(() => screen.getByTestId('toggle-item-001'))
    fireEvent.click(screen.getByTestId('toggle-item-001'))

    await waitFor(() => {
      expect(toggleAvailability).toHaveBeenCalledWith('item-001', false)
    })
  })

  test('Delete item removes it from the grid', async () => {
    getMenuAdmin.mockResolvedValueOnce({ items: ITEMS })
    deleteMenuItem.mockResolvedValueOnce({ message: 'deleted' })
    renderMM()

    await waitFor(() => screen.getByTestId('delete-item-001'))
    fireEvent.click(screen.getByTestId('delete-item-001'))

    await waitFor(() => {
      expect(screen.queryByTestId('item-card-item-001')).not.toBeInTheDocument()
    })
    expect(deleteMenuItem).toHaveBeenCalledWith('item-001')
  })

  test('Add Item modal opens and shows form', async () => {
    getMenuAdmin.mockResolvedValueOnce({ items: [] })
    renderMM()

    await waitFor(() => screen.getByTestId('add-item-btn'))
    fireEvent.click(screen.getByTestId('add-item-btn'))

    expect(screen.getByTestId('item-modal')).toBeInTheDocument()
    expect(screen.getByTestId('name-input')).toBeInTheDocument()
    expect(screen.getByTestId('price-input')).toBeInTheDocument()
    expect(screen.getByTestId('category-select')).toBeInTheDocument()
  })

  test('Save item without required fields shows validation error', async () => {
    getMenuAdmin.mockResolvedValueOnce({ items: [] })
    renderMM()

    await waitFor(() => screen.getByTestId('add-item-btn'))
    fireEvent.click(screen.getByTestId('add-item-btn'))
    fireEvent.click(screen.getByTestId('save-item-btn'))

    expect(screen.getByTestId('modal-error')).toBeInTheDocument()
    expect(createMenuItem).not.toHaveBeenCalled()
  })

})
