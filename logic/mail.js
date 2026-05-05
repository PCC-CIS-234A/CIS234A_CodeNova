/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis
  logic/mail.js

  Helper for the SEND NOTIFICATION feature.
  Nodemailer connects to your SMTP server (Gmail, Outlook, school relay, etc.)
  and sends one plain-text email. Recipients are passed in as BCC only so
  addresses stay private.
*/

const nodemailer = require('nodemailer');
const config = require('../config');

function createTransporter() {
    const { host, port, secure, user, pass } = config.smtp;

    if (!host) {
        throw new Error('SMTP_HOST is missing. Configure email settings first.');
    }

    return nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user ? { user, pass } : undefined
    });
}

/**
 * @param {object} opts
 * @param {string} opts.subject
 * @param {string} opts.body
 * @param {string} opts.senderName
 * @param {string} opts.senderEmail
 * @param {string[]} opts.bccAddresses
 */
async function sendNotificationEmail({ subject, body, senderName, senderEmail, bccAddresses }) {
    const { from } = config.smtp;

    if (!from) throw new Error('MAIL_FROM is missing in configuration.');
    if (!bccAddresses || !bccAddresses.length) {
        throw new Error('No recipient email addresses were provided.');
    }

    const transporter = createTransporter();
    const text = `${body}\n\n---\nSent by: ${senderName}\nReply-to: ${senderEmail}`;

    await transporter.sendMail({
        from,
        to: from,
        bcc: bccAddresses.length === 1 ? bccAddresses[0] : bccAddresses,
        replyTo: senderEmail || undefined,
        subject,
        text
    });
}

module.exports = { sendNotificationEmail };