const NotificationService = require('../services/notification.service');

class NotificationController {
  static async list(req, res, next) {
    try {
      const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
      const offset = parseInt(req.query.offset, 10) || 0;
      const data = await NotificationService.getNotifications(req.user.id, { limit, offset });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async markRead(req, res, next) {
    try {
      const { id } = req.params;
      const notification = await NotificationService.markAsRead(id, req.user.id);
      if (!notification) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      }
      return res.status(200).json({ success: true, data: { notification } });
    } catch (error) {
      next(error);
    }
  }

  static async markAllRead(req, res, next) {
    try {
      await NotificationService.markAllAsRead(req.user.id);
      return res.status(200).json({ success: true, data: { message: 'All notifications marked as read' } });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const success = await NotificationService.deleteNotification(id, req.user.id);
      if (!success) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Notification not found' } });
      }
      return res.status(200).json({ success: true, data: { message: 'Notification deleted' } });
    } catch (error) {
      next(error);
    }
  }

  static async markMultipleRead(req, res, next) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'ids array is required' } });
      }
      await NotificationService.markMultipleAsRead(ids, req.user.id);
      return res.status(200).json({ success: true, data: { message: 'Notifications marked as read' } });
    } catch (error) {
      next(error);
    }
  }

  static async deleteMultiple(req, res, next) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_INPUT', message: 'ids array is required' } });
      }
      await NotificationService.deleteMultiple(ids, req.user.id);
      return res.status(200).json({ success: true, data: { message: 'Notifications deleted' } });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = NotificationController;
