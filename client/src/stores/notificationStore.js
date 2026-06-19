import { create } from 'zustand'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount:   0,

  addNotification: (notification) => {
    set(state => ({
      notifications: [{ ...notification, id: Date.now(), read: false }, ...state.notifications].slice(0, 50),
      unreadCount:   state.unreadCount + 1,
    }))
  },

  markAllRead: () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
      unreadCount:   0,
    }))
  },

  markRead: (id) => {
    set(state => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unreadCount:   Math.max(0, state.unreadCount - 1),
    }))
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}))
