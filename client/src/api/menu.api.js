import api from './axios'

export const getMenu = (hotelId, params = {}) =>
  api.get(`/menu/${hotelId}`, { params }).then(r => r.data)

export const getMenuItem = (hotelId, itemId) =>
  api.get(`/menu/${hotelId}/item/${itemId}`).then(r => r.data)

export const getMenuAdmin = () =>
  api.get('/menu/admin/all').then(r => r.data)

export const createMenuItem = (formData) =>
  api.post('/menu', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)

export const updateMenuItem = (itemId, data) =>
  api.patch(`/menu/${itemId}`, data).then(r => r.data)

export const toggleAvailability = (itemId, available) =>
  api.patch(`/menu/${itemId}/availability`, { available }).then(r => r.data)

export const deleteMenuItem = (itemId) =>
  api.delete(`/menu/${itemId}`).then(r => r.data)
