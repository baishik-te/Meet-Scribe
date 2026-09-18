let io = null;

module.exports = {
  init: (socketIoInstance) => {
    io = socketIoInstance;

    io.on('connection', (socket) => {
      const userId = socket.handshake.query.userId;
      if (userId) {
        socket.join(`user:${userId}`);
      }

      socket.on('join:room', (roomName) => {
        socket.join(`room:${roomName}`);
      });

      socket.on('leave:room', (roomName) => {
        socket.leave(`room:${roomName}`);
      });

      socket.on('disconnect', () => {});
    });
  },

  getIO: () => {
    if (!io) throw new Error('Socket.IO not initialized');
    return io;
  },

  emitToUser: (userId, event, data) => {
    if (io) {
      io.to(`user:${userId}`).emit(event, data);
    }
  },

  emitToRoom: (roomName, event, data) => {
    if (io) {
      io.to(`room:${roomName}`).emit(event, data);
    }
  }
};