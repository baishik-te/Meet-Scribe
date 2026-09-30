let io = null;

module.exports = {
  init: (socketIoInstance) => {
    io = socketIoInstance;

    io.on('connection', (socket) => {
      const userId = socket.handshake.query.userId;
      if (userId) {
        socket.join(`user:${userId}`);
      }

      socket.on('join:room', async (roomName) => {
        socket.currentRoom = roomName;
        socket.join(`room:${roomName}`);
        try {
          const { syncCallBalanceAndRate } = require('./billingSync.service');
          await syncCallBalanceAndRate(roomName, socket);
        } catch (e) {
          console.warn('[Socket] Failed to sync balance on join:room:', e.message);
        }
      });

      socket.on('call:sync_balance', async (payload) => {
        const identifier = typeof payload === 'string' ? payload : (payload?.roomName || payload?.callId);
        if (identifier) {
          try {
            const { syncCallBalanceAndRate } = require('./billingSync.service');
            await syncCallBalanceAndRate(identifier, socket);
          } catch (e) {
            console.warn('[Socket] Failed to sync balance on call:sync_balance:', e.message);
          }
        }
      });

      socket.on('leave:room', async (roomName) => {
        socket.leave(`room:${roomName}`);
        if (socket.currentRoom === roomName) {
          socket.currentRoom = null;
        }
        try {
          const { checkAndEndIfEmpty } = require('./callTeardown.service');
          await checkAndEndIfEmpty(roomName, userId);
        } catch (e) {
          console.warn('[Socket] Failed to check empty room on leave:room:', e.message);
        }
      });

      socket.on('disconnect', async () => {
        if (socket.currentRoom) {
          const roomToVerify = socket.currentRoom;
          socket.currentRoom = null;
          try {
            const { checkAndEndIfEmpty } = require('./callTeardown.service');
            await checkAndEndIfEmpty(roomToVerify, userId);
          } catch (e) {
            console.warn('[Socket] Failed to check empty room on disconnect:', e.message);
          }
        }
      });
    });
  },

  getIO: () => {
    if (!io) throw new Error('Socket.IO not initialized');
    return io;
  },

  getRoomSocketCount: (roomName) => {
    if (!io) return 0;
    const room = io.sockets.adapter.rooms.get(`room:${roomName}`);
    return room ? room.size : 0;
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