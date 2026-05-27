/*

Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis, Rothy Thachnpm i

Noah McGarry - Account Creation/Login
Saul Bravo - Send Notifications
Rothy Thach - DB Interactions
Maeve Davis - Notification Log

Express + EJS + Sequelize (SQL Server). Sessions for login state,
bcrypt for password hashing, flash for messages.

  npm install
  npm start    # http://localhost:5000

Architecture:
  application/   - HTTP routes, view rendering            (top tier)
  logic/         - validation, hashing, workflows         (middle tier)
  data/          - Sequelize models and DB connection     (bottom tier)
  models/        - plain domain classes (User, ...)       (shared)

This file is the entry point. Its only jobs are: load env vars,
prove the database is reachable, and start the HTTP server. Anything
more complicated belongs in one of the layered modules.

*/

require('dotenv').config();

const app = require('./application/app');
const { initialize } = require('./data/database');

const PORT = process.env.PORT || 5000;

/**
 * Boot sequence: authenticate to the database FIRST, and only then
 * call app.listen().
 */
initialize()
  .then(() => app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  }))
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
