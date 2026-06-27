import api from './axios'

export const placeOrder = (data) =>
  api.post('/orders', data).then(r => r.data)

export const getOrder = (orderId, sessionId) =>
  api.get(`/orders/${orderId}`, { params: sessionId ? { sessionId } : {} }).then(r => r.data)

export const getOrderByTable = (tableQrToken) =>
  api.get(`/orders/table/${tableQrToken}`).then(r => r.data)

export const modifyOrder = (orderId, addItems, sessionId) =>
  api.patch(`/orders/${orderId}/modify`, { addItems, sessionId }).then(r => r.data)

export const updateOrderStatus = (orderId, status, rejectionReason) =>
  api.patch(`/orders/${orderId}/status`, { status, rejectionReason }).then(r => r.data)

export const getLiveOrders = () =>
  api.get('/orders/admin/live').then(r => r.data)

export const getMyOrders = () =>
  api.get('/orders/waiter/mine').then(r => r.data)

export const assignOrderWaiter = (orderId, waiterId) =>
  api.patch(`/orders/${orderId}/assign-waiter`, { waiterId }).then(r => r.data)

export const claimOrder = (orderId) =>
  api.patch(`/orders/${orderId}/claim`).then(r => r.data)
