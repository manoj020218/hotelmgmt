import api from './axios'

export const submitFeedback = (body) =>
  api.post('/feedback', body).then(r => r.data)

export const getAdminFeedback = (params) =>
  api.get('/feedback/admin/all', { params }).then(r => r.data)

export const getWaiterFeedback = () =>
  api.get('/feedback/waiter/mine').then(r => r.data)
