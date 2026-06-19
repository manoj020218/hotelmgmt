import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const useCartStore = create(
  persist(
    (set, get) => ({
      items:      [],
      hotelId:    null,
      tableToken: null,

      setContext: (hotelId, tableToken) => set({ hotelId, tableToken }),

      addItem: (menuItem, quantity = 1, customizations = [], specialNote = '') => {
        const { items } = get()
        // Match by menuItemId + serialized customizations
        const key = JSON.stringify(customizations)
        const idx = items.findIndex(
          i => i.menuItemId === menuItem._id && JSON.stringify(i.customizations) === key
        )
        if (idx >= 0) {
          const next = [...items]
          next[idx] = { ...next[idx], quantity: next[idx].quantity + quantity }
          set({ items: next })
        } else {
          set({
            items: [
              ...items,
              {
                menuItemId:     menuItem._id,
                name:           menuItem.name,
                price:          menuItem.price,
                isVeg:          menuItem.isVeg,
                quantity,
                customizations,
                specialNote,
              },
            ],
          })
        }
      },

      removeItem: (index) =>
        set(s => ({ items: s.items.filter((_, i) => i !== index) })),

      updateQuantity: (index, quantity) => {
        if (quantity <= 0) {
          set(s => ({ items: s.items.filter((_, i) => i !== index) }))
        } else {
          set(s => {
            const next = [...s.items]
            next[index] = { ...next[index], quantity }
            return { items: next }
          })
        }
      },

      updateNote: (index, specialNote) =>
        set(s => {
          const next = [...s.items]
          next[index] = { ...next[index], specialNote }
          return { items: next }
        }),

      clearCart: () => set({ items: [] }),

      getItemCount: () => get().items.reduce((s, i) => s + i.quantity, 0),

      getSubtotal: () =>
        get().items.reduce((s, i) => s + i.price * i.quantity, 0),
    }),
    {
      name:    'hotel-qr-cart',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
