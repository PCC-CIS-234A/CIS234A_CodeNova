const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

const notifications = [
    {
        sent_at_display: "Apr 10, 2026 1:30 PM",
        sender_email: "staff@pantry.com",
        subject: "Fresh Produce Available",
        body: "Fresh produce is available today at the campus food pantry. Please stop by between 1:00 PM and 4:00 PM while supplies last.",
        recipient_count: 126,
        date: "2026-04-10"
    },
    {
        sent_at_display: "Apr 12, 2026 10:15 AM",
        sender_email: "manager@pantry.com",
        subject: "Pantry Special Event",
        body: "The food pantry will be holding a special event this Friday with extra canned goods, snacks, and hygiene supplies available for students.",
        recipient_count: 130,
        date: "2026-04-12"
    },
    {
        sent_at_display: "Apr 17, 2026 5:00 PM",
        sender_email: "worker@pantry.com",
        subject: "Evening Pantry Hours",
        body: "The food pantry will have extended evening hours this Wednesday from 5:00 PM to 7:00 PM for students who cannot visit during the day.",
        recipient_count: 132,
        date: "2026-04-17"
    }
];

app.get("/", (req, res) => {
    res.redirect("/notifications/log");
});

app.get("/notifications/log", (req, res) => {
    const { from, to } = req.query;

    let filteredNotifications = notifications;

    if (from && to) {
        filteredNotifications = notifications.filter(notification => {
            return notification.date >= from && notification.date <= to;
        });
    }

    res.render("notifications/log", {
        title: "Notification Log",
        notifications: filteredNotifications,
        filters: { from, to },
        flash: null
    });
});

app.listen(PORT, () => {
    console.log(`Food Pantry app running at http://localhost:${PORT}`);
});
