const notificationRepository = require("../data/notificationRepository");

// Gets notifications from the data layer and applies optional filtering.
async function getFilteredNotifications(from, to, search) {
    let notifications = await notificationRepository.getAllNotifications();

    // Date filter
    if (from && to) {
        notifications = notifications.filter(notification => {
            const sentDate = notification.sent_at.toISOString().split("T")[0];
            return sentDate >= from && sentDate <= to;
        });
    }

    // Search filter
    if (search) {
        const searchText = search.toLowerCase();

        notifications = notifications.filter(notification =>
            notification.sender_email.toLowerCase().includes(searchText) ||
            notification.subject.toLowerCase().includes(searchText) ||
            notification.body.toLowerCase().includes(searchText)
        );
    }

    return notifications;
}

module.exports = {
    getFilteredNotifications,
};