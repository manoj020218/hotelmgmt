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

export const assignTableWaiter = (tableId, waiterId) =>
  api.patch(`/tables/${tableId}/assign-waiter`, { waiterId }).then(r => r.data)

export const getTableSession = (tableId) =>
  api.get(`/tables/${tableId}/session`).then(r => r.data)

export const checkoutTable = (tableId) =>
  api.post(`/tables/${tableId}/checkout`).then(r => r.data)

export const getTableHistory = (tableId) =>
  api.get(`/tables/${tableId}/history`).then(r => r.data)
