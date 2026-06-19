import api from './axios'

export const getSettings = () =>
  api.get('/settings').then(r => r.data)

export const updateHotelInfo = (data) =>
  api.patch('/settings/hotel', data).then(r => r.data)

export const updateGST = (data) =>
  api.patch('/settings/gst', data).then(r => r.data)

export const updateOperations = (data) =>
  api.patch('/settings/operations', data).then(r => r.data)

export const updateKitchen = (data) =>
  api.patch('/settings/kitchen', data).then(r => r.data)

export const updatePayment = (data) =>
  api.patch('/settings/payment', data).then(r => r.data)

export const uploadUpiQr = (file) => {
  const form = new FormData()
  form.append('qrImage', file)
  return api.post('/settings/upi-qr', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data)
}
