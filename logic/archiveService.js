const { sequelize } = require("../data/database");

async function getArchivedNotifications(from, to) {
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

    if (from && to) {
        sql += `
            WHERE sent_at >= :from
            AND sent_at < DATEADD(day, 1, :to)
        `;

        replacements.from = from;
        replacements.to = to;
    }

    sql += `
        ORDER BY sent_at DESC
    `;

    const notifications = await sequelize.query(sql, {
        replacements,
        type: sequelize.QueryTypes.SELECT
    });

    return notifications.map(n => ({
        id: n.id,
        sender_email: n.sender_email,
        subject: n.subject,
        body: n.body,
        recipient_count: n.recipient_count,
        sent_at: n.sent_at,
        sent_at_display: new Date(n.sent_at).toLocaleString()
    }));
}

module.exports = {
    getArchivedNotifications
};