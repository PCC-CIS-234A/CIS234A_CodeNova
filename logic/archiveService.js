/*
  logic/archiveService.js

  Retrieves archived notification data from the database.
  Supports optional filtering by date range and search text.
  Formats notification records for display in the user interface.
*/

const { sequelize } = require("../data/database");

/**
 * Retrieves archived notifications using optional filters.
 *
 * @param {string} from Start date filter (inclusive).
 * @param {string} to End date filter (inclusive).
 * @param {string} search Search term applied to sender, subject, and body.
 * @returns {Promise<Array>} Array of formatted notification objects.
 */
async function getArchivedNotifications(from, to, search) {
    let sql = `
        SELECT
            id,
            sender_email,
            subject,
            body,
            recipient_count,
            sent_at
        FROM notifications
    `;

    const replacements = {};
    const conditions = [];

    // Apply date range filtering when both dates are provided.
    if (from && to) {
        conditions.push(`
            sent_at >= :from
            AND sent_at < DATEADD(day, 1, :to)
        `);

        replacements.from = from;
        replacements.to = to;
    }

    // Search sender email, subject, and message body.
    if (search) {
        conditions.push(`
            (
                sender_email LIKE :search
                OR subject LIKE :search
                OR body LIKE :search
            )
        `);

        replacements.search = `%${search}%`;
    }

    // Add WHERE clause only when filters exist.
    if (conditions.length > 0) {
        sql += `
            WHERE ${conditions.join(" AND ")}
        `;
    }

    // Show newest notifications first.
    sql += `
        ORDER BY sent_at DESC
    `;

    const notifications = await sequelize.query(sql, {
        replacements,
        type: sequelize.QueryTypes.SELECT
    });

    // Format notification records for display in the archive view.
    return notifications.map(n => ({
        id: n.id,
        sender_email: n.sender_email,
        subject: n.subject,
        body: n.body,
        recipient_count: n.recipient_count,
        sent_at: n.sent_at,

        // Create a user-friendly date string for display.
        sent_at_display: new Date(n.sent_at).toLocaleString()
    }));
}

module.exports = {
    getArchivedNotifications
};