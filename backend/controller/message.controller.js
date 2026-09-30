const { Op } = require('sequelize');
const { Message, Connection, User } = require('../models');
const SocketService = require('../services/socket.service');


class MessageController {

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

  // POST /user/connections/:connectionId/messages 
  static async sendMessage(req, res, next) {
    const { connectionId } = req.params;
    const body = req.body?.body ? String(req.body.body).trim() : '';
    const file = req.file;

    try {
      if (!body && !file) {
        return res.status(400).json({
          success: false,
          error: { code: 'EMPTY_MESSAGE', message: 'Message text or attachment is required' }
        });
      }
      if (body && body.length > 5000) {
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

      let fileUrl = null;
      let fileName = null;
      let fileType = null;
      let fileSize = null;

      if (file) {
        fileUrl = `/uploads/messages/files/${file.filename}`;
        fileName = file.originalname || file.filename;
        fileType = file.mimetype || 'application/octet-stream';
        fileSize = file.size || 0;
      }

      const message = await Message.create({
        connectionId,
        senderId: req.user.id,
        receiverId: resolved.otherUserId,
        body: body || fileName || '',
        fileUrl,
        fileName,
        fileType,
        fileSize
      });

      // Push to the receiver in real time.
      SocketService.emitToUser(resolved.otherUserId, 'message:new', {
        message,
        sender: { id: req.user.id, name: req.user.name, email: req.user.email }
      });

      // Push persistent notification
      const NotificationService = require('../services/notification.service');
      let snippet = body;
      if (!snippet && file) {
        snippet = fileType?.startsWith('image/') ? '📷 Sent an image' : `📎 Sent a file: ${fileName}`;
      } else if (snippet.length > 60) {
        snippet = `${snippet.slice(0, 60)}…`;
      }

      await NotificationService.createNotification({
        userId: resolved.otherUserId,
        type: 'MESSAGE_RECEIVED',
        title: `Message from ${req.user.name}`,
        message: snippet,
        data: {
          connectionId,
          senderId: req.user.id,
          senderName: req.user.name,
          messageId: message.id,
          fileUrl,
          fileName,
          fileType
        }
      });

      return res.status(201).json({ success: true, data: { message } });
    } catch (error) {
      next(error);
    }
  }

  // GET /user/messages/summary
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
          let summaryBody = msg.body;
          if (!summaryBody && msg.fileUrl) {
            summaryBody = msg.fileType?.startsWith('image/') ? '📷 Image' : `📎 ${msg.fileName || 'Attachment'}`;
          }
          byConnection[msg.connectionId] = {
            connectionId: msg.connectionId,
            lastMessage: {
              id: msg.id,
              body: summaryBody,
              senderId: msg.senderId,
              fileUrl: msg.fileUrl,
              fileName: msg.fileName,
              fileType: msg.fileType,
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

  // POST /user/connections/:connectionId/typing
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
