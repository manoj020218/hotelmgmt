import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MenuPage from '../views/customer/MenuPage'

// ── Mocks ──────────────────────────────────────────────────────────────────────
vi.mock('../api/menu.api', () => ({
  getMenu: vi.fn(),
}))

import { getMenu } from '../api/menu.api'
import { useCartStore } from '../stores/cartStore'

// ── Test data ──────────────────────────────────────────────────────────────────
const STARTER = {
  _id: 'item1', name: 'Paneer Tikka', category: 'Starters',
  price: 150, isVeg: true, available: true,
  customizationOptions: [],
  stats: { avgRating: 4.5 }, tags: ['bestseller'],
}
const MAIN = {
  _id: 'item2', name: 'Butter Chicken', category: 'Mains',
  price: 280, isVeg: false, available: true,
  customizationOptions: [
    { groupName: 'Spice Level', type: 'single', required: true, choices: ['Mild', 'Medium', 'Spicy'] },
  ],
  stats: { avgRating: 4.2 }, tags: [],
}
const UNAVAILABLE = {
  _id: 'item3', name: 'Sold Out Item', category: 'Starters',
  price: 100, isVeg: true, available: false,
  customizationOptions: [], stats: { avgRating: 0 }, tags: [],
}

const OPEN_MENU = {
  items: [STARTER, MAIN, UNAVAILABLE],
  categories: ['Starters', 'Mains'],
  hotelName:  'Test Hotel',
  kitchenOpen: true,
}
const CLOSED_MENU = { ...OPEN_MENU, kitchenOpen: false }

// ── Helper ─────────────────────────────────────────────────────────────────────
function renderMenu(search = '?hotel=h1&table=t1') {
  return render(
    <MemoryRouter initialEntries={[`/menu${search}`]}>
      <Routes>
        <Route path="/menu"  element={<MenuPage />} />
        <Route path="/cart"  element={<div data-testid="cart-page" />} />
        <Route path="/order/:id" element={<div data-testid="order-page" />} />
      </Routes>
    </MemoryRouter>
  )
}

// ── Setup / Teardown ───────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  // Reset cart
  useCartStore.setState({ items: [], hotelId: null, tableToken: null })
})

afterEach(() => {
  sessionStorage.clear()
})

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('PF01 - Menu Screen', () => {

  test('Renders menu items from API', async () => {
    getMenu.mockResolvedValueOnce(OPEN_MENU)
    renderMenu()

    // Items appear after fetch
    await waitFor(() => {
      expect(screen.getByText('Paneer Tikka')).toBeInTheDocument()
      expect(screen.getByText('Butter Chicken')).toBeInTheDocument()
    })

    // Hotel name shown
    expect(screen.getByText('Test Hotel')).toBeInTheDocument()

    // API called with correct hotelId
    expect(getMenu).toHaveBeenCalledWith('h1')
  })

  test('Category filter shows correct items', async () => {
    getMenu.mockResolvedValueOnce(OPEN_MENU)
    renderMenu()

    await waitFor(() => screen.getByText('Paneer Tikka'))

    // Both items visible by default (All)
    expect(screen.getByText('Paneer Tikka')).toBeInTheDocument()
    expect(screen.getByText('Butter Chicken')).toBeInTheDocument()

    // Click Starters tab
    fireEvent.click(screen.getByRole('tab', { name: 'Starters' }))

    // Only starter visible
    expect(screen.getByText('Paneer Tikka')).toBeInTheDocument()
    expect(screen.queryByText('Butter Chicken')).not.toBeInTheDocument()

    // Click Mains tab
    fireEvent.click(screen.getByRole('tab', { name: 'Mains' }))
    expect(screen.queryByText('Paneer Tikka')).not.toBeInTheDocument()
    expect(screen.getByText('Butter Chicken')).toBeInTheDocument()
  })

  test('Add to cart updates cart count in floating button', async () => {
    getMenu.mockResolvedValueOnce(OPEN_MENU)
    renderMenu()

    await waitFor(() => screen.getByText('Paneer Tikka'))

    // No cart button initially
    expect(screen.queryByLabelText(/view cart/i)).not.toBeInTheDocument()

    // Click add on Paneer Tikka (no customizations)
    fireEvent.click(screen.getByLabelText(/Add Paneer Tikka to cart/i))

    // Floating cart button should appear with count 1
    await waitFor(() => {
      expect(screen.getByLabelText(/view cart with 1 item/i)).toBeInTheDocument()
    })

    // Add another
    fireEvent.click(screen.getByLabelText(/Add Paneer Tikka to cart/i))

    await waitFor(() => {
      expect(screen.getByLabelText(/view cart with 2 items/i)).toBeInTheDocument()
    })
  })

  test('Unavailable items not shown', async () => {
    getMenu.mockResolvedValueOnce(OPEN_MENU)
    renderMenu()

    await waitFor(() => screen.getByText('Paneer Tikka'))

    // Sold Out Item should NOT be visible
    expect(screen.queryByText('Sold Out Item')).not.toBeInTheDocument()
  })

  test('Closed kitchen shows banner and disables add to cart', async () => {
    getMenu.mockResolvedValueOnce(CLOSED_MENU)
    renderMenu()

    await waitFor(() => screen.getByText('Paneer Tikka'))

    // Kitchen closed banner
    expect(screen.getByRole('status')).toHaveTextContent(/kitchen is closed/i)

    // Add button is disabled
    const addBtn = screen.getByLabelText(/Add Paneer Tikka to cart/i)
    expect(addBtn).toBeDisabled()
  })

  test('Repeat order banner appears when lastOrder in sessionStorage', async () => {
    getMenu.mockResolvedValueOnce(OPEN_MENU)
    sessionStorage.setItem('lastOrder', JSON.stringify({ orderId: 'ord123' }))
    renderMenu()

    await waitFor(() => screen.getByText('Paneer Tikka'))

    expect(screen.getByTestId('repeat-order-banner')).toBeInTheDocument()
  })

  test('Item customization sheet opens on tap', async () => {
    getMenu.mockResolvedValueOnce(OPEN_MENU)
    renderMenu()

    await waitFor(() => screen.getByText('Butter Chicken'))

    // Click the item card (Butter Chicken has customizations)
    fireEvent.click(screen.getByText('Butter Chicken'))

    // Customization sheet should appear
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByText('Spice Level')).toBeInTheDocument()
    })
  })

  test('Customization selections stored in cart item', async () => {
    getMenu.mockResolvedValueOnce(OPEN_MENU)
    renderMenu()

    await waitFor(() => screen.getByText('Butter Chicken'))

    // Open customization sheet
    fireEvent.click(screen.getByText('Butter Chicken'))

    await waitFor(() => screen.getByText('Spice Level'))

    // Select 'Medium' spice level
    fireEvent.click(screen.getByLabelText ? screen.getByRole('radio', { name: 'Medium' }) : screen.getByText('Medium'))

    // Click Add to cart
    const addBtn = screen.getByRole('button', { name: /add to cart/i })
    fireEvent.click(addBtn)

    // Sheet closes
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // Cart should have the item with customization
    const state = useCartStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].name).toBe('Butter Chicken')
    expect(state.items[0].customizations[0].groupName).toBe('Spice Level')
    expect(state.items[0].customizations[0].selected).toBe('Medium')
  })

})
