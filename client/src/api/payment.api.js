import api from './axios'

export const getPaymentByOrder = (orderId, sessionId) =>
  api.get(`/payments/order/${orderId}`, { params: sessionId ? { sessionId } : {} }).then(r => r.data)

export const markPaymentReceived = (paymentId, body) =>
  api.patch(`/payments/${paymentId}/mark-received`, body).then(r => r.data)

export const getReceipt = (paymentId) =>
  api.get(`/payments/${paymentId}/receipt`).then(r => r.data)

export const getTodayPayments = () =>
  api.get('/payments/admin/today').then(r => r.data)
