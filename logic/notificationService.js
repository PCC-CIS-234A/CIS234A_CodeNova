/*
  logic/notificationService.js

  Provides business logic for retrieving and filtering notifications.
  Retrieves notification data from the repository layer and applies
  optional date range and keyword filters before returning results.
*/

const notificationRepository = require("../data/notificationRepository");

/**
 * Retrieves notifications and applies optional filters.
 *
 * @param {string} from Start date filter (inclusive).
 * @param {string} to End date filter (inclusive).
 * @param {string} search Search term applied to sender, subject, and body.
 * @returns {Promise<Array>} Filtered notification records.
 */
async function getFilteredNotifications(from, to, search) {

    // Retrieve all notifications from the data layer.
    let notifications = await notificationRepository.getAllNotifications();

    // Apply date range filtering when both dates are provided.
    if (from && to) {
        notifications = notifications.filter(notification => {
            const sentDate = notification.sent_at.toISOString().split("T")[0];
            return sentDate >= from && sentDate <= to;
        });
    }

    // Apply case-insensitive keyword filtering.
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