// Handles HTTP requests related to notifications.
const express = require("express");
const router = express.Router();
const ExcelJS = require("exceljs");

const notificationService = require("../logic/notificationService");
const archiveService = require("../logic/archiveService");
const { canUserSendNotifications } = require("../logic/logic");
const { isInvalidDateRange } = require("../logic/validation");

// Displays the notification log page.
router.get("/log", async (req, res) => {
    const user = res.locals.currentUser;
    const devBypassActive = res.locals.devBypassActive;

    if (!devBypassActive) {
        if (!user) return res.redirect("/login");

        const role = String(user.role || "").trim().toLowerCase();

        if (role !== "manager" && role !== "staff") {
            req.flash("error", "You do not have permission to view the notification log.");
            return res.redirect("/");
        }
    }

    try {
        const { from, to } = req.query;

        let flash = null;
        let notifications = [];

        if (isInvalidDateRange(from, to)) {
            flash = {
                type: "error",
                message: "The From date cannot be later than the To date."
            };

            notifications = await notificationService.getFilteredNotifications();
        } else {
            notifications = await notificationService.getFilteredNotifications(from, to);
        }

        res.render("notifications/log", {
            title: "Notification Log",
            notifications,
            filters: { from, to },
            flash,
            currentUser: user
        });
    } catch (error) {
        console.error("Error loading notifications:", error);
        res.status(500).send("Could not load notifications.");
    }
});

// Displays the notification archive page.
router.get("/archive", async (req, res) => {
    const user = res.locals.currentUser;
    const devBypassActive = res.locals.devBypassActive;

    if (!devBypassActive) {
        if (!user) return res.redirect("/login");

        const role = String(user.role || "").trim().toLowerCase();

        if (role !== "manager" && role !== "staff") {
            req.flash("error", "You do not have permission to view the notification archive.");
            return res.redirect("/");
        }
    }

    try {
        const { from, to } = req.query;

        let flash = null;
        let notifications = [];

        if (isInvalidDateRange(from, to)) {
            flash = {
                type: "error",
                message: "The From date cannot be later than the To date."
            };

            notifications = await archiveService.getArchivedNotifications();
        } else {
            notifications = await archiveService.getArchivedNotifications(from, to);
        }

        res.render("notifications/archive", {
            title: "Notification Archive",
            notifications,
            filters: { from, to },
            flash,
            currentUser: user
        });
    } catch (error) {
        console.error("Error loading archive:", error);
        res.status(500).send("Could not load notification archive.");
    }
});

// Exports the notification archive to Excel.
// Managers only.
router.get("/archive/export", async (req, res) => {
    const user = res.locals.currentUser;
    const devBypassActive = res.locals.devBypassActive;

    try {
        if (!devBypassActive && !canUserSendNotifications(user)) {
            return res.status(403).send("Access denied. Managers only.");
        }

        const { from, to } = req.query;

        if (isInvalidDateRange(from, to)) {
            return res.status(400).send("Invalid date range.");
        }

        const notifications = await archiveService.getArchivedNotifications(from, to);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Notification Archive");

        worksheet.columns = [
            { header: "Date Sent", key: "sent_at_display", width: 25 },
            { header: "Sender", key: "sender_email", width: 30 },
            { header: "Subject", key: "subject", width: 35 },
            { header: "Message Body", key: "body", width: 60 },
            { header: "Recipients", key: "recipient_count", width: 15 }
        ];

        notifications.forEach(notification => {
            worksheet.addRow(notification);
        });

        worksheet.getRow(1).font = { bold: true };

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        res.setHeader(
            "Content-Disposition",
            "attachment; filename=notification_archive.xlsx"
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error exporting archive:", error);
        res.status(500).send("Could not export notification archive.");
    }
});

module.exports = router;