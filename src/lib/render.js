import ejs from 'ejs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { formatCurrency, formatDate, formatDateTime, timeAgo } from './format.js';
import { canAssignBonus, isFieldStaff } from './roles.js';
import { getCompanySettings } from '../services/settings.js';
import { getNotificationSummary } from '../services/notifications.js';

const viewsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'views');
const helpers = { formatCurrency, formatDate, formatDateTime, timeAgo };

/**
 * Rendon një pamje EJS brenda layout-it (default: layouts/main).
 * `layout: false` e rendon pamjen pa layout.
 */
export async function render(c, view, data = {}, status = 200) {
  const { user, incoming } = c.get('session') || { user: null, incoming: {} };
  const [company, notif] = await Promise.all([
    getCompanySettings(),
    user ? getNotificationSummary(user.id) : { unreadCount: 0, recent: [] }
  ]);

  const locals = {
    ...helpers,
    currentUser: user,
    currentPath: new URL(c.req.url).pathname,
    canAssignBonus: canAssignBonus(user),
    isFieldStaff: isFieldStaff(user),
    flashSuccess: incoming.success || [],
    flashError: incoming.error || [],
    company,
    unreadNotifCount: notif.unreadCount,
    recentNotifications: notif.recent,
    ...data
  };

  const opts = { views: [viewsDir], cache: true };
  const body = await ejs.renderFile(join(viewsDir, `${view}.ejs`), locals, opts);
  const layout = locals.layout === undefined ? 'layouts/main' : locals.layout;
  const html = layout
    ? await ejs.renderFile(join(viewsDir, `${layout}.ejs`), { ...locals, body }, opts)
    : body;
  return c.html(html, status);
}

export const renderError = (c, status, pageTitle, errorMessage, layout) =>
  render(c, 'partials/error', { statusCode: status, pageTitle, errorMessage, layout }, status);
