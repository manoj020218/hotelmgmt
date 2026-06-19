import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import api from '../api/axios'

export function useAuth() {
  const { user, accessToken, refreshToken, setAuth, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const loginAdmin = useCallback(async (email, password) => {
    const res = await api.post('/auth/admin/login', { email, password })
    setAuth(res.data)
    navigate('/admin', { replace: true })
    return res.data
  }, [setAuth, navigate])

  const loginWaiter = useCallback(async (phone, pin) => {
    const res = await api.post('/auth/waiter/login', { phone, pin })
    setAuth(res.data)
    navigate('/waiter', { replace: true })
    return res.data
  }, [setAuth, navigate])

  const loginKitchen = useCallback(async (phone, pin) => {
    const res = await api.post('/auth/kitchen/login', { phone, pin })
    setAuth(res.data)
    navigate('/kds', { replace: true })
    return res.data
  }, [setAuth, navigate])

  const logout = useCallback(() => {
    const role = user?.role
    clearAuth()
    if (role === 'waiter')  navigate('/waiter/login', { replace: true })
    else if (role === 'kitchen') navigate('/kds/login', { replace: true })
    else                    navigate('/admin/login', { replace: true })
  }, [user, clearAuth, navigate])

  return {
    user,
    accessToken,
    refreshToken,
    isAuthenticated: !!user && !!accessToken,
    setAuth,
    clearAuth,
    loginAdmin,
    loginWaiter,
    loginKitchen,
    logout,
  }
}
