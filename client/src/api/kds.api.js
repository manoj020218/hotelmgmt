import api from './axios'

export const getKDSOrders = () =>
  api.get('/kds').then(r => r.data)

export const kdsAccept = (orderId) =>
  api.patch(`/kds/${orderId}/accept`).then(r => r.data)

export const kdsReject = (orderId, reason) =>
  api.patch(`/kds/${orderId}/reject`, { reason }).then(r => r.data)

export const kdsMarkReady = (orderId) =>
  api.patch(`/kds/${orderId}/ready`).then(r => r.data)
