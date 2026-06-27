import api from './axios'

export const getMyWaiterProfile = () =>
  api.get('/waiters/me').then(r => r.data)

export const toggleAvailability = (available) =>
  api.patch('/waiters/me/availability', { available }).then(r => r.data)

export const getAllWaiters = () =>
  api.get('/waiters').then(r => r.data)

export const createWaiter = (data) =>
  api.post('/waiters', data).then(r => r.data)

export const updateWaiter = (waiterId, data) =>
  api.patch(`/waiters/${waiterId}`, data).then(r => r.data)

export const deleteWaiter = (waiterId) =>
  api.delete(`/waiters/${waiterId}`).then(r => r.data)

export const getWaitersOnly = () =>
  api.get('/waiters').then(r => ({ waiters: (r.data.waiters ?? []).filter(w => w.role === 'waiter' && w.isActive !== false) }))
