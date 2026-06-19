import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from './stores/authStore'
import { PageLoader } from './components/Spinner'

const CustomerMenuPage    = lazy(() => import('./views/customer/MenuPage'))
const CustomerCartPage    = lazy(() => import('./views/customer/CartPage'))
const CustomerOrderPage   = lazy(() => import('./views/customer/OrderStatusPage'))
const CustomerPaymentPage = lazy(() => import('./views/customer/PaymentPage'))
const CustomerFeedbackPage = lazy(() => import('./views/customer/FeedbackPage'))
const WaiterApp           = lazy(() => import('./views/waiter/WaiterApp'))
const KDSScreen           = lazy(() => import('./views/kds/KDSScreen'))
const AdminPanel          = lazy(() => import('./views/admin/AdminPanel'))
const AdminLogin          = lazy(() => import('./views/auth/AdminLogin'))
const WaiterLogin         = lazy(() => import('./views/auth/WaiterLogin'))
const KDSLogin            = lazy(() => import('./views/auth/KDSLogin'))

function RequireAuth({ children, role }) {
  const user = useAuthStore(s => s.user)
  const location = useLocation()

  if (!user) {
    const loginPath =
      role === 'waiter'  ? '/waiter/login' :
      role === 'kitchen' ? '/kds/login'    :
                           '/admin/login'
    return <Navigate to={loginPath} state={{ from: location }} replace />
  }

  if (role && user.role !== role) {
    return <Navigate to="/" replace />
  }

  return children
}

function RoleRedirect() {
  const user = useAuthStore(s => s.user)
  if (!user) return <Navigate to="/admin/login" replace />
  if (user.role === 'admin')   return <Navigate to="/admin"  replace />
  if (user.role === 'waiter')  return <Navigate to="/waiter" replace />
  if (user.role === 'kitchen') return <Navigate to="/kds"    replace />
  return <Navigate to="/admin/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public / customer routes */}
          <Route path="/"               element={<RoleRedirect />} />
          <Route path="/menu"           element={<CustomerMenuPage />} />
          <Route path="/cart"           element={<CustomerCartPage />} />
          <Route path="/order/:orderId"   element={<CustomerOrderPage />} />
          <Route path="/payment/:orderId" element={<CustomerPaymentPage />} />
          <Route path="/feedback/:orderId" element={<CustomerFeedbackPage />} />

          {/* Auth routes */}
          <Route path="/admin/login"  element={<AdminLogin />} />
          <Route path="/waiter/login" element={<WaiterLogin />} />
          <Route path="/kds/login"    element={<KDSLogin />} />

          {/* Protected routes */}
          <Route
            path="/admin/*"
            element={
              <RequireAuth role="admin">
                <AdminPanel />
              </RequireAuth>
            }
          />
          <Route
            path="/waiter/*"
            element={
              <RequireAuth role="waiter">
                <WaiterApp />
              </RequireAuth>
            }
          />
          <Route
            path="/kds/*"
            element={
              <RequireAuth role="kitchen">
                <KDSScreen />
              </RequireAuth>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
