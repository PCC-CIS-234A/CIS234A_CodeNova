/*
  Saul's code — logic/mail.js (Send Notification email transport)

  Sends the pantry notification email using nodemailer.
  Plain text plus HTML; recipients are BCC'd so addresses stay private.
*/

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const config = require('../config');

const LOGO_PATH = path.join(__dirname, '..', 'public', 'pcc-logo.png');
const HEADER_BG = '#008EAA';

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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FONT_STACK =
  '-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif';

function bodyToHtmlParagraphs(body) {
  return escapeHtml(body)
    .split(/\r?\n/)
    .map((line) =>
      line === ''
        ? '<p style="margin:0 0 16px 0;font-size:0;line-height:0;">&nbsp;</p>'
        : `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;color:#3d3d3d;">${line}</p>`
    )
    .join('');
}

function buildNotificationHtml({ subject, body, senderName, includeLogo }) {
  const headline = escapeHtml(subject);
  const preheader = escapeHtml(body).replace(/\s+/g, ' ').trim().slice(0, 120);

  const logoBlock = includeLogo
    ? `<img src="cid:pccLogo" alt="Portland Community College" width="168" border="0" style="display:block;max-width:168px;height:auto;border:0;outline:none;text-decoration:none;" />`
    : `<span style="font-family:${FONT_STACK};font-size:22px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">PCC Food Pantry</span>`;

  const bodyHtml = bodyToHtmlParagraphs(body);

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>PCC Food Pantry</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <style type="text/css">
    table { border-collapse: collapse; }
    td { font-family: Arial, sans-serif; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;width:100%;background-color:#eceff3;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#eceff3;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#eceff3" style="margin:0;padding:0;width:100%;background-color:#eceff3;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
    <tr>
      <td align="center" style="padding:32px 16px 48px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
          <tr>
            <td style="border-radius:16px 16px 0 0;overflow:hidden;background-color:${HEADER_BG};background-image:linear-gradient(135deg, #0099b3 0%, #006f82 100%);padding:28px 36px 32px 36px;">
              <!--[if mso]>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="background-color:${HEADER_BG};padding:28px 36px 32px 36px;">
              <![endif]-->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td valign="middle" style="font-family:${FONT_STACK};">
                    ${logoBlock}
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:18px;font-family:${FONT_STACK};font-size:13px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.88);">
                    Food Pantry
                  </td>
                </tr>
              </table>
              <!--[if mso]></td></tr></table><![endif]-->
            </td>
          </tr>
          <tr>
            <td bgcolor="#ffffff" style="background-color:#ffffff;padding:0 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#ffffff" style="border-collapse:collapse;background-color:#ffffff;border-radius:0 0 16px 16px;overflow:hidden;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
                <tr>
                  <td style="padding:36px 32px 8px 32px;font-family:${FONT_STACK};">
                    <h1 style="margin:0 0 22px 0;font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.035em;color:#111827;">${headline}</h1>
                    ${bodyHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 32px 36px 32px;font-family:${FONT_STACK};">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;background-color:#f4f6f9;border-radius:12px;border:1px solid #e8ecf1;">
                      <tr>
                        <td style="padding:20px 22px;">
                          <p style="margin:0 0 6px 0;font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Sent by</p>
                          <p style="margin:0;font-size:16px;font-weight:600;color:#111827;">${escapeHtml(senderName)}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding:0 24px 28px 24px;font-family:${FONT_STACK};font-size:12px;line-height:1.5;color:#9ca3af;">
                    PCC Food Pantry · Portland Community College<br />
                    <span style="color:#cbd5e1;">This email was sent to you as part of pantry communications.</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendNotificationEmail({ subject, body, senderName, senderEmail, bccAddresses }) {
  void senderEmail;
  const { from } = config.smtp;

  if (!from) throw new Error('MAIL_FROM is missing in configuration.');
  if (!bccAddresses || !bccAddresses.length) {
    throw new Error('No recipient email addresses were provided.');
  }

  const transporter = createTransporter();

  const text = `${body}\n\n---\nSent by: ${senderName}`;
  const includeLogo = fs.existsSync(LOGO_PATH);
  const html = buildNotificationHtml({ subject, body, senderName, includeLogo });

  const mailOptions = {
    from,
    to: from,
    bcc: bccAddresses.length === 1 ? bccAddresses[0] : bccAddresses,
    subject,
    text,
    html
  };

  if (includeLogo) {
    mailOptions.attachments = [
      {
        filename: 'pcc-logo.png',
        path: LOGO_PATH,
        cid: 'pccLogo',
        contentType: 'image/png',
        contentDisposition: 'inline'
      }
    ];
  }

  await transporter.sendMail(mailOptions);
}

/**
 *
 *
 * Send a step-up access link so the user can reach the account-edit page
 *
 * @param {object} opts
 * @param {string} opts.toEmail      Recipient address.
 * @param {string} opts.firstName    User's first name for the greeting.
 * @param {string} opts.accessUrl    The full https://…/account/access?token=… URL.
 */
async function sendAccountAccessEmail({ toEmail, firstName, accessUrl }) {
  const { from } = config.smtp;
  if (!from) throw new Error('MAIL_FROM is missing in configuration.');

  const transporter = createTransporter();

  const escapedUrl = escapeHtml(accessUrl);
  const escapedName = escapeHtml(firstName || 'there');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Access your account settings – PCC Food Pantry</title>
</head>
<body style="margin:0;padding:0;background-color:#eceff3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eceff3;">
    <tr>
      <td align="center" style="padding:32px 16px 48px 16px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden;background-color:#ffffff;box-shadow:0 12px 40px rgba(15,23,42,0.08);">
          <tr>
            <td style="background-color:#008EAA;background-image:linear-gradient(135deg,#0099b3 0%,#006f82 100%);padding:28px 36px;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;">PCC Food Pantry</span>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 36px 28px 36px;">
              <h1 style="margin:0 0 16px 0;font-size:24px;font-weight:700;color:#111827;">Access your account settings</h1>
              <p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;color:#3d3d3d;">Hi ${escapedName},</p>
              <p style="margin:0 0 24px 0;font-size:16px;line-height:1.65;color:#3d3d3d;">
                Click the button below to access your account settings. This link is valid for 15 minutes.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius:8px;background-color:#008EAA;">
                    <a href="${escapedUrl}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">Edit my account</a>
                  </td>
                </tr>
              </table>
              <p style="margin:24px 0 0 0;font-size:13px;line-height:1.5;color:#6b7280;">
                This link expires in 15 minutes. If you did not request this, you can safely ignore this email.
              </p>
              <p style="margin:16px 0 0 0;font-size:13px;color:#9ca3af;word-break:break-all;">
                Or copy this URL into your browser: ${escapedUrl}
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 24px 28px 24px;font-size:12px;color:#9ca3af;">
              PCC Food Pantry · Portland Community College
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `Hi ${firstName || 'there'},\n\nClick this link to access your account settings (valid for 15 minutes):\n${accessUrl}\n\nIf you did not request this, ignore this email.\n\nPCC Food Pantry`;

  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'Access your account settings – PCC Food Pantry',
    text,
    html
  });
}

module.exports = { sendNotificationEmail, sendAccountAccessEmail };
