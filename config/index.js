/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis
  config/index.js

  Single place that reads .env and exposes structured settings.

  Sections:
    app  — HTTP port, session cookie signing secret, notification role filter
    smtp — SEND NOTIFICATION email (nodemailer)
    db   — Microsoft SQL Server (mssql driver)
*/

module.exports = {
    // ---- app ----
    app: {
        port: Number(process.env.PORT) || 5000,
        sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
        // Comma-separated DB roles that receive BCC (default subscriber = students).
        notificationRoles: (process.env.NOTIFICATION_ROLES || 'subscriber')
            .split(',')
            .map((r) => r.trim())
            .filter(Boolean)
    },

    // ---- smtp (SEND NOTIFICATION) ----
    smtp: {
        host: process.env.SMTP_HOST || '',
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
        from: process.env.MAIL_FROM || ''
    },

    // ---- PCC SQL Server ----
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