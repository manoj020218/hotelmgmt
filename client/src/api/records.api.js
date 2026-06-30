import api from './axios'

export const getOrderRecords = (params = {}) =>
  api.get('/records/orders', { params }).then(r => r.data)

export const deleteAllRecords = (code) =>
  api.delete('/records/all', { params: { code } }).then(r => r.data)

export const deleteBeforeDate = (date, code) =>
  api.delete('/records/before-date', { params: { date, code } }).then(r => r.data)
