import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import NotificationBell from '../components/NotificationBell'
import { useNotificationStore } from '../stores/notificationStore'

function renderBell() {
  return render(<NotificationBell />)
}

beforeEach(() => {
  useNotificationStore.setState({ notifications: [], unreadCount: 0 })
})

describe('PF08 - Notifications', () => {

  test('Bell shows unread count badge when there are unread notifications', () => {
    useNotificationStore.getState().addNotification({ title: 'New Order', body: 'Table 5 placed an order' })
    useNotificationStore.getState().addNotification({ title: 'Order Ready', body: 'Table 3 is ready' })
    renderBell()

    expect(screen.getByTestId('unread-badge')).toBeInTheDocument()
    expect(screen.getByTestId('unread-badge').textContent).toBe('2')
  })

  test('No badge when unread count is zero', () => {
    renderBell()
    expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument()
  })

  test('Clicking bell opens notification panel and marks all as read', () => {
    useNotificationStore.getState().addNotification({ title: 'New Order', body: 'Table 5' })
    renderBell()

    fireEvent.click(screen.getByTestId('notification-bell'))

    expect(screen.getByTestId('notification-panel')).toBeInTheDocument()
    expect(screen.getByText('New Order')).toBeInTheDocument()
    // After opening, unread count resets
    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  test('addNotification increments unread count', () => {
    const store = useNotificationStore.getState()
    store.addNotification({ title: 'A', body: 'b' })
    store.addNotification({ title: 'C', body: 'd' })
    expect(useNotificationStore.getState().unreadCount).toBe(2)
  })

  test('markAllRead resets unread count and marks all notifications read', () => {
    const store = useNotificationStore.getState()
    store.addNotification({ title: 'A', body: 'b' })
    store.addNotification({ title: 'C', body: 'd' })
    store.markAllRead()
    const state = useNotificationStore.getState()
    expect(state.unreadCount).toBe(0)
    expect(state.notifications.every(n => n.read)).toBe(true)
  })

  test('Notifications panel shows empty state when no notifications', () => {
    renderBell()
    fireEvent.click(screen.getByTestId('notification-bell'))
    expect(screen.getByText(/no notifications/i)).toBeInTheDocument()
  })

})
