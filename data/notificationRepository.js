/*
  data/notificationRepository.js  --  Data layer

  Reads notification rows from the database for the notification log.
  Uses the shared Sequelize instance from database.js so we stay on one
  consistent DB driver (tedious) and don't need a second connection pool.
*/

const { Notification } = require('./database');

/**
 * Format a JS Date into a readable string that matches the old SQL
 * FORMAT(sent_at, 'MMM dd, yyyy h:mm tt') output.
 * Example: "May 25, 2026 3:45 PM"
 *
 * @param {Date} date
 * @returns {string}
 */
function formatSentAt(date) {
  if (!date) return '';
  return new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Reads all notifications from the database, newest first.
 * Each row has an extra `sent_at_display` string for the view.
 *
 * @returns {Promise<object[]>}
 */
async function getAllNotifications() {
  const rows = await Notification.findAll({
    order: [['sent_at', 'DESC']]
  });

  return rows.map((row) => {
    const data = row.toJSON();
    data.sent_at_display = formatSentAt(data.sent_at);
    return data;
  });
}

module.exports = {
  getAllNotifications
};
