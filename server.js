// Entry point of the application. Sets up middleware, routes, and starts the server.
const express = require("express");
const path = require("path");
const notificationRoutes = require("./application/notificationRoutes");

const app = express();
const PORT = 3000;

// Set EJS as the template engine and tell Express where the view files are stored.
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files such as CSS, images, and client-side JavaScript.
app.use(express.static(path.join(__dirname, "public")));

// Allow Express to read form data from POST requests.
app.use(express.urlencoded({ extended: true }));

// Redirect the home page to the notification log page.
app.get("/", (req, res) => {
    res.redirect("/notifications/log");
});

// Send all notification-related requests to the notification routes file.
app.use("/notifications", notificationRoutes);

// Start the web server.
app.listen(PORT, () => {
    console.log("Food Pantry app running at http://localhost:3000/notifications/log");
});