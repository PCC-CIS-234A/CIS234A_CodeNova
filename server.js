/*

Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis

Noah McGarry - Account Creation/Login
Saul Bravo - Send Notifications
Maeve Davis - Notification Log

Express + EJS + Sequelize (SQL Server). Sessions for login state,
bcrypt for password hashing, flash for messages.

  npm install
  npm start    # http://localhost:5000

Architecture:
  application/   - HTTP routes, view rendering            (top tier)
  logic/         - validation, hashing, workflows         (middle tier)
  data/          - Sequelize models and DB connection     (bottom tier)

This file is the entry point: it loads env vars, authenticates
the database connection, and starts the HTTP server.

*/

require('dotenv').config();

const app = require('./application/app');
const { initialize } = require('./data/database');

const PORT = process.env.PORT || 5000;

initialize()
  .then(() => app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  }))
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
