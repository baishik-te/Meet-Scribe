const { Op } = require('sequelize');
const { Message, Connection, User } = require('../models');
const SocketService = require('../services/socket.service');


class MessageController {
  /**
   * Resolve an ACCEPTED connection the requester belongs to, returning the
   * connection and the id of the other participant. Returns null if not found
   * or the requester is not a participant.
   */
  static async resolveConnection(connectionId, userId) {
    const connection = await Connection.findOne({
      where: {
        id: connectionId,
        status: 'ACCEPTED',
        [Op.or]: [{ requesterId: userId }, { receiverId: userId }]
      }
    });
    if (!connection) return null;
    const otherUserId =
      connection.requesterId === userId ? connection.receiverId : connection.requesterId;
    return { connection, otherUserId };
  }

  // GET /user/connections/:connectionId/messages
  // Returns the full chronological thread and marks the requester's inbound
  // messages as read.
  static async getMessages(req, res, next) {
    const { connectionId } = req.params;
    try {
      const resolved = await MessageController.resolveConnection(connectionId, req.user.id);
      if (!resolved) {
        return res.status(404).json({
          success: false,
          error: { code: 'CONNECTION_NOT_FOUND', message: 'Accepted connection not found' }
        });
      }

      const messages = await Message.findAll({
        where: { connectionId },
        order: [['createdAt', 'ASC']]
      });

      // Mark inbound unread messages as read now that the thread is opened.
      const now = new Date();
      await Message.update(
        { readAt: now },
        { where: { connectionId, receiverId: req.user.id, readAt: null } }
      );

      // Let the sender know their messages were read.
      SocketService.emitToUser(resolved.otherUserId, 'message:read', {
        connectionId,
        readerId: req.user.id,
        readAt: now
      });

      return res.status(200).json({ success: true, data: { messages } });
    } catch (error) {
      next(error);
    }
  }

  // POST /user/connections/:connectionId/messages  { body }
  static async sendMessage(req, res, next) {
    const { connectionId } = req.params;
    const { body } = req.body;
    try {
      if (!body || !body.trim()) {
        return res.status(400).json({
          success: false,
          error: { code: 'EMPTY_MESSAGE', message: 'Message body is required' }
        });
      }
      if (body.length > 5000) {
        return res.status(400).json({
          success: false,
          error: { code: 'MESSAGE_TOO_LONG', message: 'Message exceeds 5000 characters' }
        });
      }

      const resolved = await MessageController.resolveConnection(connectionId, req.user.id);
      if (!resolved) {
        return res.status(404).json({
          success: false,
          error: { code: 'CONNECTION_NOT_FOUND', message: 'Accepted connection not found' }
        });
      }

      const message = await Message.create({
        connectionId,
        senderId: req.user.id,
        receiverId: resolved.otherUserId,
        body: body.trim()
      });

      // Push to the receiver in real time.
      SocketService.emitToUser(resolved.otherUserId, 'message:new', {
        message,
        sender: { id: req.user.id, name: req.user.name, email: req.user.email }
      });

      return res.status(201).json({ success: true, data: { message } });
    } catch (error) {
      next(error);
    }
  }

  // GET /user/messages/summary
  // Per-connection last message + unread count, for the conversation sidebar.
  static async getSummary(req, res, next) {
    try {
      const connections = await Connection.findAll({
        where: {
          status: 'ACCEPTED',
          [Op.or]: [{ requesterId: req.user.id }, { receiverId: req.user.id }]
        },
        attributes: ['id']
      });
      const connectionIds = connections.map((c) => c.id);

      if (connectionIds.length === 0) {
        return res.status(200).json({ success: true, data: { summaries: [] } });
      }

      const messages = await Message.findAll({
        where: { connectionId: { [Op.in]: connectionIds } },
        order: [['createdAt', 'DESC']]
      });

      const byConnection = {};
      for (const msg of messages) {
        if (!byConnection[msg.connectionId]) {
          byConnection[msg.connectionId] = {
            connectionId: msg.connectionId,
            lastMessage: {
              id: msg.id,
              body: msg.body,
              senderId: msg.senderId,
              createdAt: msg.createdAt
            },
            unreadCount: 0
          };
        }
        if (msg.receiverId === req.user.id && msg.readAt === null) {
          byConnection[msg.connectionId].unreadCount += 1;
        }
      }

      return res.status(200).json({
        success: true,
        data: { summaries: Object.values(byConnection) }
      });
    } catch (error) {
      next(error);
    }
  }

  // POST /user/connections/:connectionId/typing  { typing: boolean }
  // Ephemeral typing indicator relay (no persistence).
  static async setTyping(req, res, next) {
    const { connectionId } = req.params;
    const { typing } = req.body;
    try {
      const resolved = await MessageController.resolveConnection(connectionId, req.user.id);
      if (!resolved) {
        return res.status(404).json({
          success: false,
          error: { code: 'CONNECTION_NOT_FOUND', message: 'Accepted connection not found' }
        });
      }

      SocketService.emitToUser(resolved.otherUserId, 'message:typing', {
        connectionId,
        userId: req.user.id,
        typing: Boolean(typing)
      });

      return res.status(200).json({ success: true, data: { ok: true } });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = MessageController;
