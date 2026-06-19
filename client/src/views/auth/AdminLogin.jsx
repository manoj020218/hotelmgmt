import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { useAuthStore } from '../../stores/authStore'
import api from '../../api/axios'

export default function AdminLogin() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const setAuth  = useAuthStore(s => s.setAuth)
  const navigate = useNavigate()
  const location = useLocation()
  const from     = location.state?.from?.pathname ?? '/admin'

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/admin/login', { email, password })
      setAuth(res.data)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.error ?? 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-text mb-1">Hotel QR</h1>
          <p className="text-textMuted text-sm">Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-bgCard rounded-2xl border border-border p-6 space-y-4">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="admin@hotel.com"
            required
            autoFocus
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {error && (
            <p className="text-red text-sm bg-red/10 border border-red/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <Button type="submit" fullWidth loading={loading}>
            Sign In
          </Button>
        </form>

        <div className="mt-4 text-center space-y-1">
          <a href="/waiter/login" className="block text-xs text-textMuted hover:text-text transition-colors">
            Waiter login →
          </a>
          <a href="/kds/login" className="block text-xs text-textMuted hover:text-text transition-colors">
            Kitchen display login →
          </a>
        </div>
      </div>
    </div>
  )
}
