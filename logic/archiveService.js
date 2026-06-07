const { sequelize } = require("../data/database");

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

    if (from && to) {
        conditions.push(`
        sent_at >= :from
        AND sent_at < DATEADD(day, 1, :to)
    `);

        replacements.from = from;
        replacements.to = to;
    }

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

    if (conditions.length > 0) {
        sql += `
        WHERE ${conditions.join(" AND ")}
    `;
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