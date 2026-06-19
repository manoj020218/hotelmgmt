import { useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || ''

let _socket = null

function getSocket() {
  if (!_socket) {
    _socket = io(SOCKET_URL, {
      autoConnect:      false,
      reconnection:     true,
      reconnectionDelay: 1000,
      transports:       ['websocket', 'polling'],
    })
  }
  return _socket
}

export function useSocket({ hotelId, orderId, tableId, role, userId } = {}) {
  const listenersRef = useRef([])

  useEffect(() => {
    const socket = getSocket()
    if (!socket.connected) socket.connect()

    if (hotelId) socket.emit('join:hotel', { hotelId, role, userId })
    if (tableId)  socket.emit('join:table', { tableId })
    if (orderId)  socket.emit('join:order', { orderId })

    return () => {
      // Remove all listeners registered in this hook instance
      listenersRef.current.forEach(({ event, fn }) => socket.off(event, fn))
      listenersRef.current = []
    }
  }, [hotelId, orderId, tableId, role, userId])

  const on = useCallback((event, fn) => {
    const socket = getSocket()
    socket.on(event, fn)
    listenersRef.current.push({ event, fn })
  }, [])

  const emit = useCallback((event, data) => {
    getSocket().emit(event, data)
  }, [])

  return { on, emit, socket: getSocket() }
}

export function disconnectSocket() {
  if (_socket) {
    _socket.disconnect()
    _socket = null
  }
}
