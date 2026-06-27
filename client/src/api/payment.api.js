import api from './axios'
import axios from 'axios'

const BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

export const requestPayment = (orderId, sessionId, method) =>
  axios.post(`${BASE}/payments/request/${orderId}`, { method }, { params: sessionId ? { sessionId } : {} }).then(r => r.data)

export const getPendingPayments = () =>
  api.get('/payments/pending').then(r => r.data)

export const getPaymentByOrder = (orderId, sessionId) =>
  api.get(`/payments/order/${orderId}`, { params: sessionId ? { sessionId } : {} }).then(r => r.data)

export const markPaymentReceived = (paymentId, body) =>
  api.patch(`/payments/${paymentId}/mark-received`, body).then(r => r.data)

export const getReceipt = (paymentId) =>
  api.get(`/payments/${paymentId}/receipt`).then(r => r.data)

export const getTodayPayments = () =>
  api.get('/payments/admin/today').then(r => r.data)
