/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis
  logic/logic.js  -  Logic Layer

  Business rules for signup and login: input validation, password
  hashing, and the workflow that ties them together. Talks to the
  data layer via Sequelize models.

  User-facing problems are thrown as `AuthError`; the application
  layer turns those into flash messages.
*/

const bcrypt = require('bcryptjs');
const config = require('../config');
const { sequelize, Op, User, Notification, NotificationRecipient } = require('../data/database');
const { sendNotificationEmail } = require('./mail');

const SALT_ROUNDS = 12;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,30}$/;
const UPPERCASE_RE = /[A-Z]/;
const DIGIT_RE = /[0-9]/;
const SPECIAL_CHAR_RE = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/;

/* Values stored in users.role (SQL Server). */
const ROLE_MANAGER = 'manager';
const ROLE_STAFF = 'staff';
const ROLE_SUBSCRIBER = 'subscriber';

/* Form values from signup. */
const SIGNUP_ROLES = ['student', 'manager', 'staff'];

/*
 * Reads role from POST body (handles missing key, alternate names, or array duplicates).
 */
function pickSignupRoleFromBody(body) {
  if (!body) return 'student';
  const raw = body.signup_role ?? body.signupRole ?? body.account_type ?? body.role;
  const v = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (v == null || String(v).trim() === '') return 'student';
  return String(v).trim().toLowerCase();
}

function signupRoleToDbRole(signupRole) {
  if (signupRole === 'student') return ROLE_SUBSCRIBER;
  if (signupRole === 'manager') return ROLE_MANAGER;
  if (signupRole === 'staff') return ROLE_STAFF;
  return ROLE_SUBSCRIBER;
}

/* Only managers may Send Notification. Accepts a plain object or a User instance. */
function canUserSendNotifications(user) {
  if (!user) return false;
  const raw = typeof user.normalizedRole === 'string'
    ? user.normalizedRole
    : (user.role != null ? String(user.role).trim().toLowerCase() : '');
  return raw === ROLE_MANAGER;
}

// Dummy hash used when no user is found at login, so timing doesn't
// reveal whether the username/email exists.
const DUMMY_HASH = '$2b$12$0123456789012345678901abcdefabcdefabcdefabcdefabcdefab';

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

async function signup(body) {
  const username = (body.username || '').trim().toLowerCase();
  const first_name = (body.first_name || '').trim();
  const last_name = (body.last_name || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';
  const confirm_password = body.confirm_password || '';
  const signupRole = pickSignupRoleFromBody(body);

  if (!username || !first_name || !last_name || !email || !password) {
    throw new AuthError('All fields are required.');
  }
  if (!SIGNUP_ROLES.includes(signupRole)) {
    throw new AuthError('Choose a valid account type: Student, Manager, or Staff.');
  }
  if (!USERNAME_RE.test(username)) {
    throw new AuthError('Username must be 3-30 characters: letters, numbers, dots, underscores, or hyphens.');
  }
  if (password.length < 8) {
    throw new AuthError('Password must be at least 8 characters.');
  }
  if (!UPPERCASE_RE.test(password)) {
    throw new AuthError('Password must contain at least one uppercase letter.');
  }
  if (!DIGIT_RE.test(password)) {
    throw new AuthError('Password must contain at least one number.');
  }
  if (!SPECIAL_CHAR_RE.test(password)) {
    throw new AuthError('Password must contain at least one special character (e.g. ! @ # $ % & *).');
  }
  if (password !== confirm_password) {
    throw new AuthError('The two passwords do not match.');
  }

  // If username already exists/in use, non-specific error message
  if (await User.findOne({ where: { username }, attributes: ['id'] })) {
    throw new AuthError('Could not create your account.');
  }
  // If email already exists/in use, non-specific error message
  if (await User.findOne({ where: { email }, attributes: ['id'] })) {
    throw new AuthError('Could not create your account.');
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const dbRole = signupRoleToDbRole(signupRole);

  // Wrapped in a transaction so an unexpected role substitution by an
  // AFTER INSERT trigger or column default does not leave a bad row
  try {
    return await sequelize.transaction(async (t) => {
      const created = await User.create(
        { username, first_name, last_name, email, password_hash, role: dbRole },
        { transaction: t }
      );

      // Re-read the row inside the same transaction to catch trigger interference.
      const check = await User.findByPk(created.id, {
        attributes: ['role'],
        transaction: t
      });
      const saved = check && check.role != null
        ? String(check.role).trim().toLowerCase()
        : '';
      if (saved !== dbRole) {
        throw new Error(
          `Database stored role "${check ? check.role : null}" instead of "${dbRole}". ` +
          'Remove or fix triggers/defaults on users.role, or widen CHECK constraints.'
        );
      }
      return { userId: created.id, first_name };
    });
  } catch (err) {
    // Sequelize wraps unique-constraint violations as SequelizeUniqueConstraintError;
    // display them as the same vague message used above.
    if (err && err.name === 'SequelizeUniqueConstraintError') {
      throw new AuthError('Could not create your account.');
    }
    throw new AuthError(err.message || 'Could not create your account.');
  }
}

async function login(body) {
  const identifier = (body.identifier || '').trim().toLowerCase();
  const password = body.password || '';

  if (!identifier || !password) {
    throw new AuthError('Both fields are required.');
  }

  // Single lookup against either the username or email column. Both columns
  // are stored lowercased at signup, and identifier is lowercased above,
  // so a direct comparison is fine
  const user = await User.findOne({
    where: { [Op.or]: [{ username: identifier }, { email: identifier }] },
    attributes: ['id', 'password_hash']
  });

  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !ok) {
    throw new AuthError('Invalid username/email or password.');
  }

  return { userId: user.id };
}

async function getCurrentUser(userId) {
  const user = await User.findByPk(userId);
  return user ? user.toPublic() : null;
}

/*
 * Loads recipients from the DB, sends one BCC email to every
 * user whose role is listed in config.app.notificationRoles, then records
 * the send (notification + junction rows) inside one transaction.
 */
async function sendBroadcastNotification({ subject, body, senderName, senderEmail }) {
  const roleNames = config.app.notificationRoles;

  const recipients = await User.findAll({
    where: {
      role: { [Op.in]: roleNames },
      email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
    },
    attributes: ['id', 'email']
  });

  if (!recipients.length) {
    throw new AuthError(
      'No recipients found. Add users with a matching role (see NOTIFICATION_ROLES in .env).'
    );
  }

  const bccAddresses = recipients.map((r) => r.email);
  await sendNotificationEmail({
    subject,
    body,
    senderName,
    senderEmail,
    bccAddresses
  });

  await sequelize.transaction(async (t) => {
    const notification = await Notification.create(
      {
        sender_email: String(senderEmail).slice(0, 100),
        subject: String(subject).slice(0, 150),
        body,
        recipient_count: recipients.length
      },
      { transaction: t }
    );

    await NotificationRecipient.bulkCreate(
      recipients.map((r) => ({ notification_id: notification.id, user_id: r.id })),
      { transaction: t }
    );
  });
}

module.exports = {
  AuthError,
  signup,
  login,
  getCurrentUser,
  sendBroadcastNotification,
  canUserSendNotifications,
  pickSignupRoleFromBody
};
