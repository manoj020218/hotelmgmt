let _io = null;

function initSocket(io) {
  _io = io;

  io.on('connection', (socket) => {
    socket.on('join:hotel', ({ hotelId } = {}) => {
      if (hotelId) socket.join(`hotel:${hotelId}`);
    });

    socket.on('join:table', ({ tableId } = {}) => {
      if (tableId) socket.join(`table:${tableId}`);
    });

    socket.on('join:order', ({ orderId } = {}) => {
      if (orderId) socket.join(`order:${orderId}`);
    });
  });
}

function emitToHotel(hotelId, event, data) {
  if (_io) _io.to(`hotel:${hotelId}`).emit(event, data);
}

function emitToOrder(orderId, event, data) {
  if (_io) _io.to(`order:${orderId}`).emit(event, data);
}

module.exports = { initSocket, emitToHotel, emitToOrder };
