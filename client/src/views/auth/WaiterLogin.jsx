import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/Button'
import { Input } from '../../components/Input'
import { useAuthStore } from '../../stores/authStore'
import api from '../../api/axios'

export default function WaiterLogin() {
  const [hotelId, setHotelId] = useState('')
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const setAuth  = useAuthStore(s => s.setAuth)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/waiter/login', { hotelId, pin })
      setAuth(res.data)
      navigate('/waiter', { replace: true })
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
          <p className="text-textMuted text-sm">Waiter Login</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-bgCard rounded-2xl border border-border p-6 space-y-4">
          <Input
            label="Hotel ID"
            type="text"
            value={hotelId}
            onChange={e => setHotelId(e.target.value)}
            placeholder="Provided by your manager"
            required
            autoFocus
          />
          <Input
            label="PIN"
            type="password"
            value={pin}
            onChange={e => setPin(e.target.value)}
            placeholder="4-digit PIN"
            maxLength={4}
            inputMode="numeric"
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

        <div className="mt-4 text-center">
          <a href="/admin/login" className="text-xs text-textMuted hover:text-text transition-colors">
            ← Admin login
          </a>
        </div>
      </div>
    </div>
  )
}
