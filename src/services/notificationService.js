const prisma = require('../config/prisma');

const notifCache = new Map(); // key: userId, value: { unreadCount, recent, time }
const NOTIF_CACHE_TTL = 20 * 1000; // 20 sekonda cache

class NotificationService {
  static invalidateCache(userId) {
    if (userId) {
      notifCache.delete(userId);
      notifCache.delete('global');
    } else {
      notifCache.clear();
    }
  }

  static async create({ userId, title, message, type = 'info', linkUrl = null }) {
    try {
      const notif = await prisma.notification.create({
        data: {
          userId: userId || null,
          title,
          message,
          type,
          linkUrl,
          isRead: false
        }
      });
      NotificationService.invalidateCache(userId);
      return notif;
    } catch (err) {
      console.error('Gabim në krijimin e njoftimit:', err);
    }
  }

  static async getUserSummary(userId) {
    const key = userId ? String(userId) : 'global';
    const now = Date.now();
    const cached = notifCache.get(key);
    if (cached && (now - cached.time < NOTIF_CACHE_TTL)) {
      return cached.data;
    }

    try {
      const [unreadCount, recent] = await Promise.all([
        prisma.notification.count({
          where: {
            isRead: false,
            OR: [
              { userId: userId || undefined },
              { userId: null }
            ]
          }
        }),
        prisma.notification.findMany({
          where: {
            OR: [
              { userId: userId || undefined },
              { userId: null }
            ]
          },
          orderBy: { createdAt: 'desc' },
          take: 5
        })
      ]);

      const result = { unreadCount: unreadCount || 0, recent: recent || [] };
      notifCache.set(key, { data: result, time: now });
      return result;
    } catch (err) {
      return { unreadCount: 0, recent: [] };
    }
  }

  static async getUnreadCount(userId) {
    const summary = await this.getUserSummary(userId);
    return summary.unreadCount;
  }

  static async getRecent(userId, limit = 5) {
    const summary = await this.getUserSummary(userId);
    return summary.recent.slice(0, limit);
  }
}

module.exports = NotificationService;

