const { sql, getConnection } = require("./db");

// Reads all notifications from the database.
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

// Writes a new notification to the database.
async function createNotification(notification) {
    const pool = await getConnection();

    await pool.request()
        .input("sender_email", sql.VarChar, notification.senderEmail)
        .input("subject", sql.VarChar, notification.subject)
        .input("body", sql.VarChar, notification.body)
        .input("recipient_count", sql.Int, notification.recipientCount)
        .input("date", sql.Date, notification.date)
        .query(`
            INSERT INTO Notifications 
                (sender_email, subject, body, recipient_count, date)
            VALUES 
                (@sender_email, @subject, @body, @recipient_count, @date)
        `);
}

module.exports = {
    getAllNotifications,
    createNotification
};