import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

// Lazy import to avoid circular dependency
function getAuthStore() {
  return import('../stores/authStore').then(m => m.useAuthStore)
}

api.interceptors.request.use(async (config) => {
  const store = await getAuthStore()
  const token = store.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let failedQueue  = []

function processQueue(error, token = null) {
  failedQueue.forEach(p => (error ? p.reject(error) : p.resolve(token)))
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    const isAuthEndpoint = original?.url?.includes('/auth/')
    if (error.response?.status !== 401 || original._retry || isAuthEndpoint) {
      return Promise.reject(error)
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing    = true

    try {
      const store        = await getAuthStore()
      const { refreshToken, setAuth, clearAuth } = store.getState()

      if (!refreshToken) throw new Error('No refresh token')

      const res         = await axios.post(`${import.meta.env.VITE_API_URL || '/api'}/auth/refresh`, { refreshToken })
      const newAccess   = res.data.accessToken
      const newRefresh  = res.data.refreshToken ?? refreshToken

      setAuth({ ...store.getState(), accessToken: newAccess, refreshToken: newRefresh })
      processQueue(null, newAccess)

      original.headers.Authorization = `Bearer ${newAccess}`
      return api(original)
    } catch (err) {
      processQueue(err, null)
      const store = await getAuthStore()
      store.getState().clearAuth()
      // Route to login based on previous page
      const path = window.location.pathname
      if (path.startsWith('/waiter')) window.location.href = '/waiter/login'
      else if (path.startsWith('/kds'))  window.location.href = '/kds/login'
      else                               window.location.href = '/admin/login'
      return Promise.reject(err)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
