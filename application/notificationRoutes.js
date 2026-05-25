// Handles HTTP requests related to notifications.
const express = require("express");
const router = express.Router();
const notificationService = require("../logic/notificationService");

// Displays the notification log page.
router.get("/log", async (req, res) => {
    try {
        const { from, to } = req.query;

        let flash = null;
        let notifications = [];

        // Show an error if the From date is later than the To date
        if (from && to && from > to) {
            flash = {
                type: "error",
                message: "The From date cannot be later than the To date."
            };

            // Still show all notifications instead of filtering with bad dates
            notifications = await notificationService.getFilteredNotifications();
        } else {
            notifications = await notificationService.getFilteredNotifications(from, to);
        }

        res.render("notifications/log", {
            title: "Notification Log",
            notifications,
            filters: { from, to },
            flash
        });
    } catch (error) {
        console.error("Error loading notifications:", error);
        res.status(500).send("Could not load notifications.");
    }
});

module.exports = router;