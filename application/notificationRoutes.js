// Handles HTTP requests related to notifications.
const express = require("express");
const router = express.Router();
const notificationService = require("../logic/notificationService");

// Displays the notification log page.
router.get("/log", async (req, res) => {
    try {
        const { from, to } = req.query;

        const notifications = await notificationService.getFilteredNotifications(from, to);

        res.render("notifications/log", {
            title: "Notification Log",
            notifications,
            filters: { from, to },
            flash: null
        });
    } catch (error) {
        console.error("Error loading notifications:", error);
        res.status(500).send("Could not load notifications.");
    }
});

// Saves a new notification to the database.
router.post("/create", async (req, res) => {
    try {
        await notificationService.createNotification(req.body);
        res.redirect("/notifications/log");
    } catch (error) {
        console.error("Error creating notification:", error);
        res.status(500).send("Could not create notification.");
    }
});

module.exports = router;