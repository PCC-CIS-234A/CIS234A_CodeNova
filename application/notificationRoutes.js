/*
  application/notificationRoutes.js

  Defines routes for viewing, filtering, archiving, and exporting notifications.
  Handles access control, query parameters, validation, and rendering notification views.
*/

const express = require("express");
const router = express.Router();
const ExcelJS = require("exceljs");

const notificationService = require("../logic/notificationService");
const archiveService = require("../logic/archiveService");
const { canUserSendNotifications } = require("../logic/logic");
const { isInvalidDateRange } = require("../logic/validation");

/**
 * GET /notifications/log
 *
 * Displays the active notification log.
 * Supports optional date range and search filters.
 * Accessible to managers and staff unless development bypass is active.
 */
router.get("/log", async (req, res) => {
    const user = res.locals.currentUser;
    const devBypassActive = res.locals.devBypassActive;

    // Restrict access to authenticated managers and staff in normal mode.
    if (!devBypassActive) {
        if (!user) return res.redirect("/login");

        const role = String(user.role || "").trim().toLowerCase();

        if (role !== "manager" && role !== "staff") {
            req.flash("error", "You do not have permission to view the notification log.");
            return res.redirect("/");
        }
    }

    try {
        const { from, to, search } = req.query;

        let flash = null;
        let notifications = [];

        // Prevent invalid date filters while still showing the default log.
        if (isInvalidDateRange(from, to)) {
            flash = {
                type: "error",
                message: "The From date cannot be later than the To date."
            };

            notifications = await notificationService.getFilteredNotifications();
        } else {
            notifications = await notificationService.getFilteredNotifications(from, to, search);
        }

        res.render("notifications/log", {
            title: "Notification Log",
            notifications,
            filters: { from, to, search },
            flash,
            currentUser: user
        });
    } catch (error) {
        console.error("Error loading notifications:", error);
        res.status(500).send("Could not load notifications.");
    }
});

/**
 * GET /notifications/archive
 *
 * Displays archived notifications.
 * Supports optional date range and search filters.
 * Accessible to managers and staff unless development bypass is active.
 */
router.get("/archive", async (req, res) => {
    const user = res.locals.currentUser;
    const devBypassActive = res.locals.devBypassActive;

    // Restrict access to authenticated managers and staff in normal mode.
    if (!devBypassActive) {
        if (!user) return res.redirect("/login");

        const role = String(user.role || "").trim().toLowerCase();

        if (role !== "manager" && role !== "staff") {
            req.flash("error", "You do not have permission to view the notification archive.");
            return res.redirect("/");
        }
    }

    try {
        const { from, to, search } = req.query;

        let flash = null;
        let notifications = [];

        // Prevent invalid date filters while still showing the default archive.
        if (isInvalidDateRange(from, to)) {
            flash = {
                type: "error",
                message: "The From date cannot be later than the To date."
            };

            notifications = await archiveService.getArchivedNotifications();
        } else {
            notifications = await archiveService.getArchivedNotifications(from, to, search);
        }

        res.render("notifications/archive", {
            title: "Notification Archive",
            notifications,
            filters: { from, to, search },
            flash,
            currentUser: user
        });
    } catch (error) {
        console.error("Error loading archive:", error);
        res.status(500).send("Could not load notification archive.");
    }
});

/**
 * GET /notifications/archive/export
 *
 * Exports filtered archived notifications to an Excel spreadsheet.
 * Managers only unless development bypass is active.
 */
router.get("/archive/export", async (req, res) => {
    const user = res.locals.currentUser;
    const devBypassActive = res.locals.devBypassActive;

    try {
        // Only users with manager-level send permissions may export archive data.
        if (!devBypassActive && !canUserSendNotifications(user)) {
            return res.status(403).send("Access denied. Managers only.");
        }

        const { from, to, search } = req.query;

        if (isInvalidDateRange(from, to)) {
            return res.status(400).send("Invalid date range.");
        }

        const notifications = await archiveService.getArchivedNotifications(from, to, search);

        // Create workbook and worksheet for the exported archive.
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Notification Archive");

        // Define column labels, data keys, and readable column widths.
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

        // Bold the header row for readability.
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