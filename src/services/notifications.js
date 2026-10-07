import { prisma } from '../db.js';

const TTL = 20 * 1000;
const cache = new Map();
const scope = (userId) => ({ OR: [{ userId: userId || undefined }, { userId: null }] });

export const invalidateNotifications = (userId) => {
  if (userId) cache.delete(String(userId));
  else cache.clear();
  cache.delete('global');
};

export async function createNotification({ userId, title, message, type = 'info', linkUrl = null }) {
  try {
    const n = await prisma.notification.create({
      data: { userId: userId || null, title, message, type, linkUrl, isRead: false }
    });
    invalidateNotifications(userId);
    return n;
  } catch (err) {
    console.error('Gabim në krijimin e njoftimit:', err);
  }
}

export async function getNotificationSummary(userId) {
  const key = userId ? String(userId) : 'global';
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < TTL) return hit.data;
  try {
    const [unreadCount, recent] = await Promise.all([
      prisma.notification.count({ where: { isRead: false, ...scope(userId) } }),
      prisma.notification.findMany({ where: scope(userId), orderBy: { createdAt: 'desc' }, take: 5 })
    ]);
    const data = { unreadCount, recent };
    cache.set(key, { data, time: Date.now() });
    return data;
  } catch {
    return { unreadCount: 0, recent: [] };
  }
}
