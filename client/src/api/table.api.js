import api from './axios'

export const getAdminTables = () =>
  api.get('/tables').then(r => r.data)

export const createTable = (data) =>
  api.post('/tables', data).then(r => r.data)

export const updateTableStatus = (tableId, body) =>
  api.patch(`/tables/${tableId}/status`, body).then(r => r.data)

export const addTableNote = (tableId, body) =>
  api.post(`/tables/${tableId}/notes`, body).then(r => r.data)

export const getTableQR = (tableId) =>
  api.get(`/tables/${tableId}/qr`).then(r => r.data)
