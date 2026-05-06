/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis
  logic/logic.js  -  Logic Layer

  Business rules for signup and login: input validation, password
  hashing, and the workflow that ties them together. Talks to the
  data layer.

  User-facing problems are thrown as `AuthError`, the application
  layer turns those into flash messages.
*/

const bcrypt = require('bcryptjs');
const config = require('../config');
const db = require('../data/database');
const { sendNotificationEmail } = require('./mail');

const SALT_ROUNDS = 12;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,30}$/;

/** Values stored in users.role (SQL Server) */
const ROLE_MANAGER = 'manager';
const ROLE_STAFF = 'staff';
const ROLE_SUBSCRIBER = 'subscriber';

/** Form values from signup */
const SIGNUP_ROLES = ['student', 'manager', 'staff'];

/**
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

/** Only managers may Send Notification (role normalized in findUserById). */
function canUserSendNotifications(user) {
  const r = user && user.role != null ? String(user.role).trim().toLowerCase() : '';
  return r === ROLE_MANAGER;
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
  if (password !== confirm_password) {
    throw new AuthError('The two passwords do not match.');
  }

  // If username already exists/in use, non-specific error message
  if (await db.findUserByUsername(username)) {
    throw new AuthError('Could not create your account.');
  }
  //If email already exists/in use, non-specific error message
  if (await db.findUserByEmail(email)) {
    throw new AuthError('Could not create your account.');
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const role = signupRoleToDbRole(signupRole);
  let userId;
  try {
    userId = await db.createUser({
      username,
      first_name,
      last_name,
      email,
      password_hash,
      role
    });
  } catch (err) {
    throw new AuthError(err.message || 'Could not create your account.');
  }

  return { userId, first_name };
}

async function login(body) {
  const identifier = (body.identifier || '').trim().toLowerCase();
  const password = body.password || '';

  if (!identifier || !password) {
    throw new AuthError('Both fields are required.');
  }

  const user = await db.findCredentialsByIdentifier(identifier);
  const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);

  if (!user || !ok) {
    throw new AuthError('Invalid username/email or password.');
  }

  return { userId: user.id };
}

async function getCurrentUser(userId) {
  return db.findUserById(userId);
}

/*
 * Orchestration. loads recipients from the DB
 * Sends email (BCC) to every user whose role is listed in
 * config.app.notificationRoles, then records the send in SQL Server.
 */
async function sendBroadcastNotification({ subject, body, senderName, senderEmail }) {
  const roleNames = config.app.notificationRoles;
  const recipients = await db.getUserEmailsByRoles(roleNames);
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
  await db.saveNotificationWithRecipients({
    senderEmail,
    subject,
    body,
    recipientUserIds: recipients.map((r) => r.id)
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