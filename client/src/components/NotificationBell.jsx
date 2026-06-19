import { useState } from 'react'
import { useNotificationStore } from '../stores/notificationStore'

export default function NotificationBell() {
  const { notifications, unreadCount, markAllRead, markRead } = useNotificationStore()
  const [open, setOpen] = useState(false)

  const toggle = () => {
    setOpen(o => !o)
    if (!open && unreadCount > 0) markAllRead()
  }

  return (
    <div className="relative">
      <button
        data-testid="notification-bell"
        onClick={toggle}
        className="relative p-2 text-textMuted hover:text-text transition-colors"
        aria-label="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute -top-0.5 -right-0.5 bg-red text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notification-panel"
          className="absolute right-0 top-10 w-72 bg-bgCard border border-border rounded-xl shadow-xl overflow-hidden z-50"
        >
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-text">Notifications</p>
            <button onClick={() => setOpen(false)} className="text-textMuted text-xs">✕</button>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-textMuted text-sm py-8">No notifications</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`px-4 py-3 border-b border-border cursor-pointer hover:bg-bgElevated transition-colors ${n.read ? 'opacity-60' : ''}`}
                >
                  <p className="text-sm font-medium text-text">{n.title}</p>
                  <p className="text-xs text-textMuted mt-0.5">{n.body}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
