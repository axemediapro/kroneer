const prisma = require('../config/prisma');

class ActivityService {
  static async log({ userId, userName, actionType, entityType, entityId, description }) {
    try {
      return await prisma.activity.create({
        data: {
          userId: userId || null,
          userName: userName || 'Sistemi',
          actionType: actionType || 'Veprim',
          entityType: entityType || 'Sistem',
          entityId: entityId ? parseInt(entityId) : null,
          description: description || ''
        }
      });
    } catch (err) {
      console.error('Gabim në regjistrimin e aktivitetit:', err);
    }
  }
}

module.exports = ActivityService;
