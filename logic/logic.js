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
/* ----- Saul's code: email transport for Send Notification ----- */
const { sendNotificationEmail } = require('./mail');
/* ----- end Saul's code ----- */


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

/* ----- Saul's code: route guard and sender resolution for Send Notification ----- */
function mayAccessSendNotification(req) {
  if (req.currentUser && canUserSendNotifications(req.currentUser)) return true;
  if (!req.currentUser && config.app.devBypassNotifications && req.session && req.session.devBypass) return true;
  return false;
}

function resolveBroadcastSender(req) {
  const u = req.currentUser;
  if (u && canUserSendNotifications(u)) {
    return {
      senderName: `${u.first_name} ${u.last_name}`,
      senderEmail: u.email
    };
  }
  if (!u && config.app.devBypassNotifications && req.session && req.session.devBypass) {
    const senderEmail =
      config.app.devBypassSenderEmail ||
      (config.smtp && config.smtp.user ? String(config.smtp.user).trim() : '');
    if (!senderEmail) {
      throw new AuthError(
        'Dev bypass needs DEV_BYPASS_SENDER_EMAIL or SMTP_USER set for the sender reply-to line.'
      );
    }
    return {
      senderName: config.app.devBypassSenderName,
      senderEmail
    };
  }
  throw new AuthError('Not authorized to send notifications.');
}
/* ----- end Saul's code ----- */

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
 * Update the current user's editable details. The role column is
 * deliberately NOT writeable here -- a user can change their name,
 * username, email, and (optionally) password, but never their own role.
 *
 * If password is provided, current_password must also be provided and
 * must match the stored hash. Leaving the new-password field blank means
 * "don't change my password" and current_password is then ignored.
 *
 * Throws AuthError for any user-fixable problem (bad current password,
 * validation failure, duplicate username/email). Anything else propagates.
 *
 * @param {number} userId  The id of the user being edited.
 * @param {object} body    The Express req.body from POST /account.
 * @returns {Promise<{userId:number, first_name:string}>}
 */
async function updateAccount(userId, body) {
  const row = await UserModel.findByPk(userId);
  if (!row) {
    throw new AuthError('Account not found.');
  }

  // Build a User domain object using the current role from
  // the DB, not anything in the request body. This is the defense
  // that stops a user from elevating their own role via a hidden field.
  const user = new User({
    id:         row.id,
    username:   body.username,
    first_name: body.first_name,
    last_name:  body.last_name,
    email:      body.email,
    role:       row.role
  });

  const fieldError = user.validate();
  if (fieldError) throw new AuthError(fieldError);

  // Uniqueness checks: username and email must remain unique across the
  // table, except for the current user's own row.
  const dupUsername = await UserModel.findOne({
    where: { username: user.username, id: { [Op.ne]: userId } },
    attributes: ['id']
  });
  if (dupUsername) {
    throw new AuthError('That username is already taken.');
  }
  const dupEmail = await UserModel.findOne({
    where: { email: user.email, id: { [Op.ne]: userId } },
    attributes: ['id']
  });
  if (dupEmail) {
    throw new AuthError('That email address is already in use.');
  }

  // Password change is optional. If the new-password field is non-empty,
  // we require current_password to match and the two new fields to agree.
  const newPassword = body.password || '';
  const confirmPassword = body.confirm_password || '';
  let newHash = null;
  if (newPassword || confirmPassword) {
    const currentPassword = body.current_password || '';
    if (!currentPassword) {
      throw new AuthError('Enter your current password to change it.');
    }
    const ok = await bcrypt.compare(currentPassword, row.password_hash);
    if (!ok) {
      throw new AuthError('Current password is incorrect.');
    }
    const passwordError = User.validatePassword(newPassword, confirmPassword);
    if (passwordError) throw new AuthError(passwordError);
    newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  }

  try {
    await sequelize.transaction(async (t) => {
      const updates = {
        username:   user.username,
        first_name: user.first_name,
        last_name:  user.last_name,
        email:      user.email
      };
      if (newHash) updates.password_hash = newHash;
      await row.update(updates, { transaction: t });
    });
    return { userId: row.id, first_name: row.first_name };
  } catch (err) {
    if (err && err.name === 'SequelizeUniqueConstraintError') {
      throw new AuthError('That username or email is already in use.');
    }
    throw new AuthError(err.message || 'Could not update your account.');
  }
}

/**
 * Permanently delete the current user's account row. Requires the user
 * to re-supply their password as a second authentication check.
 *
 * The notifications the user received stay in the notifications table
 * (broadcast audit log), but the user's rows in notification_recipient
 * and user_list have to be cleared first (Those FKs have no
 * ON DELETE CASCADE, so leaving them in place would make the users row
 * undeletable.
 *
 * @param {number} userId    The id of the user being deleted.
 * @param {string} password  The password the user typed on the confirm page.
 * @returns {Promise<void>}
 */
async function deleteAccount(userId, password) {
  const row = await UserModel.findByPk(userId);
  if (!row) {
    throw new AuthError('Account not found.');
  }
  // Make them prove account ownership one more time. A logged-in session
  // alone isn't enough for something this destructive -- if a browser is
  // left open, or a cookie is hijacked, the password check is the last
  // line of defense.
  const supplied = password || '';
  if (!supplied) {
    throw new AuthError('Enter your password to confirm.');
  }
  const ok = await bcrypt.compare(supplied, row.password_hash);
  if (!ok) {
    throw new AuthError('Password is incorrect. Account was not deleted.');
  }
  try {
    await sequelize.transaction(async (t) => {
      // Clear the junction rows that point at this user. We keep the
      // parent notifications themselves so the broadcast log stays intact.
      await NotificationRecipient.destroy({
        where: { user_id: userId },
        transaction: t
      });
      // user_list has a FK to users(user_id) but no Sequelize model in
      // this app, so we hit it with a raw parameterized DELETE. Same
      // story as notification_recipient: clear the references first
      // or SQL Server refuses to drop the parent row.
      await sequelize.query(
        'DELETE FROM user_list WHERE user_id = :userId',
        {
          replacements: { userId },
          type: sequelize.QueryTypes.DELETE,
          transaction: t
        }
      );
      await row.destroy({ transaction: t });
    });
  } catch (err) {
    throw new AuthError(err.message || 'Could not delete your account.');
  }
}

/* ----- Saul's code: mass notification (SMTP + DB log) ----- */
/**
 * Send one broadcast notification to every user whose role appears in
 * config app notification roles.
 *
 * @param {object} opts  { subject, body, senderName, senderEmail }.
 * @returns {Promise<void>}
 */
async function sendBroadcastNotification({ subject, body, senderName, senderEmail }) {
  const roleNames = config.app.notificationRoles;

  const recipients = await UserModel.findAll({
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
/* ----- end Saul's code ----- */

module.exports = {
  AuthError,
  signup,
  login,
  getCurrentUser,
  updateAccount,
  deleteAccount,
  sendBroadcastNotification,
  canUserSendNotifications,
  pickSignupRoleFromBody,
  /* ----- Saul's code ----- */
  mayAccessSendNotification,
  resolveBroadcastSender
  /* ----- end Saul's code ----- */
};
