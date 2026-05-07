const Notification = require("./Notification");
const notificationRepository = require("../data/notificationRepository");

// Gets notifications from the data layer and applies optional date filtering.
async function getFilteredNotifications(from, to) {
    const notifications = await notificationRepository.getAllNotifications();

    if (from && to) {
        return notifications.filter(notification => {
            const sentDate = notification.sent_at.toISOString().split("T")[0];
            return sentDate >= from && sentDate <= to;
        });
    }

    return notifications;
}

// Validates form data, creates a Notification object, and sends it to the data layer.
async function createNotification(formData) {
    const notification = new Notification(
        formData.sender_email,
        formData.subject,
        formData.body,
        formData.recipient_count,
        formData.sent_at
    );

    return await notificationRepository.createNotification(notification);
}

module.exports = {
    getFilteredNotifications,
    createNotification
};