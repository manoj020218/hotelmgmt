import api from './axios'

export const getDashboard = (period = 'today') =>
  api.get('/analytics/dashboard', { params: { period } }).then(r => r.data)

export const getRevenue = (params) =>
  api.get('/analytics/revenue', { params }).then(r => r.data)

export const getTopItems = () =>
  api.get('/analytics/items').then(r => r.data)

export const exportCSV = (params) =>
  api.get('/analytics/export', { params, responseType: 'blob' }).then(r => r.data)
