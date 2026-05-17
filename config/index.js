/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis
  config/index.js

  The one place that reads .env and turns it into structured settings
  the rest of the app can require(). If you ever wonder "where does
  this setting come from?" - it's here, and the answer is either an
  environment variable or the fallback default written next to it.

  Sections:
    app  - HTTP port, session cookie signing secret, notification role filter
    smtp - Outgoing email config used by the SEND NOTIFICATION feature
    db   - Microsoft SQL Server connection settings (mssql driver)
*/

module.exports = {
    // ---- app ----
    /**
     * Application-level settings: which port to listen on, the secret
     * used to sign session cookies, and which DB roles are considered
     * "notification recipients" when a manager hits Send.
     */
    app: {
        port: Number(process.env.PORT) || 5000,
        sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
        // Comma-separated DB roles that receive BCC. Defaults to just
        // "subscriber" (students) -- override via NOTIFICATION_ROLES
        // in .env if you want managers or staff included too.
        notificationRoles: (process.env.NOTIFICATION_ROLES || 'subscriber')
            .split(',')
            .map((r) => r.trim())
            .filter(Boolean)
    },

    // ---- smtp (SEND NOTIFICATION) ----
    /**
     * Outgoing email settings for Nodemailer. `from` is the MAIL_FROM
     * service address; everything else is the SMTP server we connect
     * to. Leave SMTP_HOST blank in dev and the mailer will throw with
     * a clear message instead of silently swallowing sends.
     */
    smtp: {
        host: process.env.SMTP_HOST || '',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.MAIL_FROM || ''
    },

    // ---- PCC SQL Server ----
    /**
     * Database connection for the PCC SQL Server instance. `encrypt`
     * defaults to true (you have to opt OUT for unencrypted local
     * dev); `trustServerCertificate` defaults to false (you have to
     * opt IN, e.g. for self-signed certs on the school dev server).
     */
    db: {
        server: process.env.DB_SERVER || '',
        user: process.env.DB_USER || '',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || '',
        port: Number(process.env.DB_PORT) || 1433,
        encrypt: process.env.DB_ENCRYPT !== 'false',
        trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true'
    }
};
