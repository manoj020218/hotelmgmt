import api from './axios'

export const getTablesForOrder = () =>
  api.get('/orders/waiter-tables').then(r => r.data)

export const getMenuForWaiterOrder = (tableId) =>
  api.get(`/orders/waiter-menu/${tableId}`).then(r => r.data)

export const placeWaiterOrder = (tableId, items) =>
  api.post('/orders/waiter-place', { tableId, items }).then(r => r.data)
