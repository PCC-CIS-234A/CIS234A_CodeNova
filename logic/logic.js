/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis
  logic/logic.js  -  Logic Layer (middle tier)

  Business rules for signup and login: builds User domain objects from
  request input, runs them through validate(), then persists via the
  Sequelize UserModel.

  User-facing problems get thrown as AuthError; the application layer
  catches those and renders them as flash messages. Anything else
  propagates up to the Express error handler.
*/

const bcrypt = require('bcryptjs');
const config = require('../config');
const { sequelize, Op, UserModel, Notification, NotificationRecipient } = require('../data/database');
const User = require('../models/User');


/** Encryption factor for bcrypt. Higher = slower = harder to brute-force. 12
 *  is roughly 250ms on a modern laptop -- slow enough for security,
 *  fast enough that login still feels snappy. */
const SALT_ROUNDS = 12;

/** Role strings as they appear in users.role. */
const ROLE_MANAGER = 'manager';
const ROLE_STAFF = 'staff';
const ROLE_SUBSCRIBER = 'subscriber';

/** What the signup form's account-type will actually send us. */
const SIGNUP_ROLES = ['student', 'manager', 'staff'];

/**
 * Read the chosen account type off a POST body, and we tolerate the value
 * arriving as an array in case some duplicate input ever sneaks in.
 *
 * @param {object} body  Express req.body.
 * @returns {string}     A lowercase signup-role string, or 'student' if nothing usable was sent.
 */
function pickSignupRoleFromBody(body) {
  if (!body) return 'student';
  const raw = body.signup_role ?? body.signupRole ?? body.account_type ?? body.role;
  const v = Array.isArray(raw) ? raw[raw.length - 1] : raw;
  if (v == null || String(v).trim() === '') return 'student';
  return String(v).trim().toLowerCase();
}

/**
 * Translate the form's vocabulary (student/manager/staff) into the
 * vocabulary the database actually uses in users.role
 * (subscriber/manager/staff). "Student" maps to "subscriber" because
 * students are our default audience for broadcast emails.
 *
 * @param {string} signupRole
 * @returns {string} The corresponding DB role.
 */
function signupRoleToDbRole(signupRole) {
  if (signupRole === 'student') return ROLE_SUBSCRIBER;
  if (signupRole === 'manager') return ROLE_MANAGER;
  if (signupRole === 'staff') return ROLE_STAFF;
  return ROLE_SUBSCRIBER;
}

/**
 * Manages who can send broadcast notifications.
 *
 * @param {{normalizedRole?:string, role?:string}|null|undefined} user
 * @returns {boolean}
 */
function canUserSendNotifications(user) {
  if (!user) return false;
  const raw = typeof user.normalizedRole === 'string'
    ? user.normalizedRole
    : (user.role != null ? String(user.role).trim().toLowerCase() : '');
  return raw === ROLE_MANAGER;
}

/**
 * A real bcrypt hash that nothing matches. We compare against this
 * when login can't find the user, so the response takes about the
 * same time as a successful lookup and an attacker can't tell from
 * timing alone whether the account exists.
 */
const DUMMY_HASH = '$2b$12$0123456789012345678901abcdefabcdefabcdefabcdefabcdefab';

/**
 * Thrown for problems the user can actually fix (bad password,
 * duplicate username, etc.). The application layer catches these and
 * shows the message as a flash. Anything else gets treated as a real
 * bug and bubbles up to Express's error handler.
 */
class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Create a new user account. We build a User instance from the form,
 * run its structural validators, hash the password, and then insert
 * the row inside a transaction with the database. After the insert
 * we check the row to make sure no AFTER INSERT trigger or column
 * default rewrote the role behind our back -- better to fail loudly
 * than to silently store the wrong role.
 *
 * Throws AuthError on user-fixable problems (validation issues,
 * duplicate username/email). Other errors issue normally.
 *
 * @param {object} body  The Express req.body from POST /signup.
 * @returns {Promise<{userId:number, first_name:string}>}
 */
async function signup(body) {
  // Form-vocabulary check happens here because the User class only
  // knows about DB roles. Catching a bogus form value before we map
  // it lets us give an appropriate error message.
  const signupRole = pickSignupRoleFromBody(body);
  if (!SIGNUP_ROLES.includes(signupRole)) {
    throw new AuthError('Choose a valid account type: Student, Manager, or Staff.');
  }

  // Build the domain User from the form. The constructor normalizes
  // (trim + lowercase where appropriate); we hand off to validate()
  // for the structural rules.
  const user = User.fromSignupForm(body, signupRoleToDbRole(signupRole));

  const fieldError = user.validate();
  if (fieldError) throw new AuthError(fieldError);

  const passwordError = User.validatePassword(body.password || '', body.confirm_password || '');
  if (passwordError) throw new AuthError(passwordError);

  // Uniqueness checks need the database, so they stay here rather
  // than on User. Vague error message either way so attackers can't
  // probe for valid usernames or emails.
  if (await UserModel.findOne({ where: { username: user.username }, attributes: ['id'] })) {
    throw new AuthError('Could not create your account.');
  }
  if (await UserModel.findOne({ where: { email: user.email }, attributes: ['id'] })) {
    throw new AuthError('Could not create your account.');
  }

  // All checks pass -- > lock in the password.
  user.password_hash = await bcrypt.hash(body.password, SALT_ROUNDS);

  // Wrapped in a transaction so an unexpected role substitution by
  // a trigger or default doesn't leave a bad row hanging around.
  try {
    return await sequelize.transaction(async (t) => {
      const created = await UserModel.create(user.toPersistence(), { transaction: t });
      user.id = created.id;

      // Re-read the row inside the same transaction. If a trigger
      // overwrote our role, bail out so the rollback fires.
      const check = await UserModel.findByPk(user.id, {
        attributes: ['role'],
        transaction: t
      });
      const saved = check && check.role != null
        ? String(check.role).trim().toLowerCase()
        : '';
      if (saved !== user.role) {
        throw new Error(
          `Database stored role "${check ? check.role : null}" instead of "${user.role}". ` +
          'Remove or fix triggers/defaults on users.role, or widen CHECK constraints.'
        );
      }
      return { userId: user.id, first_name: user.first_name };
    });
  } catch (err) {
    // Sequelize wraps unique-constraint violations as
    // SequelizeUniqueConstraintError; surface them as the same vague
    // message we used above so callers can't tell which field collided.
    if (err && err.name === 'SequelizeUniqueConstraintError') {
      throw new AuthError('Could not create your account.');
    }
    throw new AuthError(err.message || 'Could not create your account.');
  }
}

/**
 * Look up the user by either their username or their email and check
 * the typed password against the stored bcrypt hash. If we can't find
 * them, we still run bcrypt against a dummy hash so the response time
 * is roughly the same -- an attacker can't probe for valid accounts
 * by timing the response.
 *
 * @param {object} body  The Express req.body from POST /login.
 * @returns {Promise<{userId:number}>}
 */
async function login(body) {
  const identifier = (body.identifier || '').trim().toLowerCase();
  const password = body.password || '';

  if (!identifier || !password) {
    throw new AuthError('Both fields are required.');
  }

  // Single lookup against either column. Both were stored lowercased
  // at signup and we lowercased the identifier above, so a direct
  // equality compare is fine.
  const row = await UserModel.findOne({
    where: { [Op.or]: [{ username: identifier }, { email: identifier }] },
    attributes: ['id', 'password_hash']
  });

  const ok = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);

  if (!row || !ok) {
    throw new AuthError('Invalid credentials.');
  }

  return { userId: row.id };
}

/**
 * Load a user by id and return the safe, display-ready shape. Strips
 * password_hash and anything else we don't want to leak into views or
 * session data. Used by the user-loader middleware to attach
 * `currentUser` to every response.
 *
 * @param {number} userId
 * @returns {Promise<object|null>} The output of User#toPublic(), or null if no such user.
 */
async function getCurrentUser(userId) {
  const row = await UserModel.findByPk(userId);
  if (!row) return null;
  return new User(row.toJSON()).toPublic();
}

/**
 * Send one broadcast notification to every user whose role appears in
 * config.app.notificationRoles.
 *
 * Currently a stub: the email transport (logic/mail.js) has been
 * removed. Calling this will throw so we don't silently "send"
 * notifications.
 *
 * @param {object} _opts     { subject, body, senderName, senderEmail }.
 * @returns {Promise<void>}
 * @throws {Error}           Always, until the email layer is reimplemented.
 */
async function sendBroadcastNotification(_opts) {
  // Reference these so eslint and the linter see them as "used" -- they
  // come back into play the moment the email layer is wired up again.
  void config; void UserModel; void Notification; void NotificationRecipient; void Op; void sequelize;
  throw new Error(
    'Email layer (logic/mail.js) has been removed. Reimplement before calling sendBroadcastNotification.'
  );
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
