const prisma = require('../config/prisma');

class NotificationService {
  static async create({ userId, title, message, type = 'info', linkUrl = null }) {
    try {
      return await prisma.notification.create({
        data: {
          userId: userId || null,
          title,
          message,
          type,
          linkUrl,
          isRead: false
        }
      });
    } catch (err) {
      console.error('Gabim në krijimin e njoftimit:', err);
    }
  }

  static async getUnreadCount(userId) {
    try {
      return await prisma.notification.count({
        where: {
          isRead: false,
          OR: [
            { userId: userId },
            { userId: null }
          ]
        }
      });
    } catch (err) {
      return 0;
    }
  }

  static async getRecent(userId, limit = 5) {
    try {
      return await prisma.notification.findMany({
        where: {
          OR: [
            { userId: userId },
            { userId: null }
          ]
        },
        orderBy: { createdAt: 'desc' },
        take: limit
      });
    } catch (err) {
      return [];
    }
  }
}

module.exports = NotificationService;
