const { getConnection } = require("./db");

// Reads all notifications from the database for the notification log.
// This keeps SQL/database code in the data layer instead of the route file.
async function getAllNotifications() {
    const pool = await getConnection();

    const result = await pool.request().query(`
        SELECT
            id,
            sender_email,
            subject,
            body,
            recipient_count,
            sent_at,
            FORMAT(sent_at, 'MMM dd, yyyy h:mm tt') AS sent_at_display
        FROM dbo.notifications
        ORDER BY sent_at DESC
    `);

    return result.recordset;
}

module.exports = {
    getAllNotifications
};