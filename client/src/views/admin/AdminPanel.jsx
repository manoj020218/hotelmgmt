import { lazy, Suspense } from 'react'
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../stores/authStore'
import { Spinner } from '../../components/Spinner'
import NotificationBell from '../../components/NotificationBell'

const Dashboard    = lazy(() => import('./Dashboard'))
const LiveOrders   = lazy(() => import('./LiveOrders'))
const MenuManager  = lazy(() => import('./MenuManager'))
const TableManager = lazy(() => import('./TableManager'))
const WaiterManager = lazy(() => import('./WaiterManager'))
const Analytics    = lazy(() => import('./Analytics'))
const Payments     = lazy(() => import('./Payments'))
const Feedback     = lazy(() => import('./Feedback'))
const Settings     = lazy(() => import('./Settings'))

const NAV_ITEMS = [
  { to: '',         icon: '📊', label: 'Dashboard'  },
  { to: 'orders',   icon: '📋', label: 'Live Orders' },
  { to: 'menu',     icon: '🍽️', label: 'Menu'        },
  { to: 'tables',   icon: '🪑', label: 'Tables'      },
  { to: 'waiters',  icon: '🙋', label: 'Waiters'     },
  { to: 'analytics',icon: '📈', label: 'Analytics'   },
  { to: 'payments', icon: '💳', label: 'Payments'    },
  { to: 'feedback', icon: '⭐', label: 'Feedback'    },
  { to: 'settings', icon: '⚙️', label: 'Settings'    },
]

function Sidebar() {
  const clearAuth = useAuthStore(s => s.clearAuth)
  const navigate  = useNavigate()

  return (
    <aside className="w-16 lg:w-48 flex-shrink-0 bg-bgCard border-r border-border flex flex-col">
      <div className="p-3 border-b border-border">
        <p className="hidden lg:block font-display font-bold text-accent text-sm">Hotel QR</p>
        <p className="block lg:hidden text-accent text-xl text-center">H</p>
      </div>
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === ''}
            className={({ isActive }) => [
              'flex items-center gap-2 px-3 py-2.5 mx-1 rounded-lg text-sm transition-colors',
              isActive
                ? 'bg-accent/10 text-accent'
                : 'text-textMuted hover:text-text hover:bg-bgElevated',
            ].join(' ')}
          >
            <span className="text-base">{item.icon}</span>
            <span className="hidden lg:block">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="p-2 border-t border-border">
        <button
          data-testid="logout-btn"
          onClick={() => { clearAuth(); navigate('/admin/login') }}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-textMuted hover:text-red hover:bg-red/10 transition-colors"
        >
          <span>🚪</span>
          <span className="hidden lg:block">Logout</span>
        </button>
      </div>
    </aside>
  )
}

// Stub sub-pages that are built in later pipelines
function StubPage({ title }) {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-textMuted">{title} — Coming soon</p>
    </div>
  )
}

export default function AdminPanel() {
  const user = useAuthStore(s => s.user)

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="h-12 border-b border-border flex items-center justify-between px-4 flex-shrink-0">
          <p className="text-textMuted text-sm">Welcome, <span className="text-text font-medium">{user?.name}</span></p>
          <NotificationBell />
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<div className="flex items-center justify-center h-full"><Spinner size="xl" /></div>}>
            <Routes>
              <Route index      element={<Dashboard />} />
              <Route path="orders"    element={<LiveOrders />} />
              <Route path="menu"      element={<MenuManager />} />
              <Route path="tables"    element={<TableManager />} />
              <Route path="waiters"   element={<WaiterManager />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="payments"  element={<Payments />} />
              <Route path="feedback"  element={<Feedback />} />
              <Route path="settings"  element={<Settings />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  )
}
