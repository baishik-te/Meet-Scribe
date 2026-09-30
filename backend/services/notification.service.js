const { Notification } = require('../models');
const SocketService = require('./socket.service');

class NotificationService {
  /**
   * Create a persistent notification and push it in real-time via Socket.IO
   */
  static async createNotification({ userId, type, title, message, data = {} }) {
    try {
      if (!userId || !title || !message) {
        console.warn('[NotificationService] Missing required fields for notification');
        return null;
      }

      // Prevent duplicate notification spam if an identical notification is already present
      const existing = await Notification.findOne({
        where: {
          userId,
          type: type || 'SYSTEM',
          message
        }
      });

      if (existing) {
        console.log(`[NotificationService] Notification with identical message already present for user ${userId} (${type}), skipping duplicate.`);
        return existing;
      }

      const notification = await Notification.create({
        userId,
        type: type || 'SYSTEM',
        title,
        message,
        data: data || {},
        read: false
      });

      // Real-time delivery
      SocketService.emitToUser(userId, 'notification:new', {
        notification
      });

      return notification;
    } catch (err) {
      console.error('[NotificationService.createNotification] Error:', err.message);
      return null;
    }
  }

  /**
   * List recent notifications for a user with unread counter
   */
  static async getNotifications(userId, { limit = 50, offset = 0 } = {}) {
    const [notifications, unreadCount] = await Promise.all([
      Notification.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit,
        offset
      }),
      Notification.count({
        where: { userId, read: false }
      })
    ]);

    return { notifications, unreadCount };
  }

  /**
   * Mark a single notification as read
   */
  static async markAsRead(notificationId, userId) {
    const notification = await Notification.findOne({
      where: { id: notificationId, userId }
    });

    if (!notification) return null;

    notification.read = true;
    notification.readAt = new Date();
    await notification.save();

    return notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  static async markAllAsRead(userId) {
    await Notification.update(
      { read: true, readAt: new Date() },
      { where: { userId, read: false } }
    );
    return true;
  }

  /**
   * Delete a notification
   */
  static async deleteNotification(notificationId, userId) {
    const notification = await Notification.findOne({
      where: { id: notificationId, userId }
    });

    if (!notification) return false;

    await notification.destroy();
    return true;
  }

  /**
   * Mark multiple notifications as read for a user
   */
  static async markMultipleAsRead(ids, userId) {
    const { Op } = require('sequelize');
    if (!Array.isArray(ids) || ids.length === 0) return true;
    await Notification.update(
      { read: true, readAt: new Date() },
      { where: { id: { [Op.in]: ids }, userId, read: false } }
    );
    return true;
  }

  /**
   * Delete multiple notifications for a user
   */
  static async deleteMultiple(ids, userId) {
    const { Op } = require('sequelize');
    if (!Array.isArray(ids) || ids.length === 0) return true;
    await Notification.destroy({
      where: { id: { [Op.in]: ids }, userId }
    });
    return true;
  }
}

module.exports = NotificationService;
