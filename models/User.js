/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis
  models/User.js

  This is the representation of a user in our app.
  It holds the fields a user has and checks them for validity.

  Typical flow: the logic layer builds one of these from a signup form,
  runs validate(), and then hands toPersistence() off to the data layer
  to actually save the row. On the way back out we wrap loaded rows in a
  User and call toPublic() to get a safe, display-ready object.
*/

/** Username has to be 3-30 chars: letters, digits, dot, underscore, hyphen. */
const USERNAME_RE = /^[A-Za-z0-9._-]{3,30}$/;

/** Loose email check: a name part, an @, and a domain with at least one dot
 *  and no whitespace anywhere. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Matches the width of the users.email column  */
const EMAIL_MAX_LENGTH = 100;

const UPPERCASE_RE = /[A-Z]/;
const DIGIT_RE = /[0-9]/;
const SPECIAL_CHAR_RE = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]/;

/** The role values we actually store in users.role. Anything outside this
 *  list is a programming bug, not a user-input problem. */
const VALID_DB_ROLES = ['manager', 'staff', 'subscriber'];

class User {
  /**
   * Build a User from whatever shape of object you use - a
   * raw form body, a row from Sequelize, a test fixture, etc. Everything
   * gets trimmed; username and email get lowercased so we have exactly one
   * standard format when we compare or store them later.
   *
   * @param {object} [fields]
   * @param {number} [fields.id]             Database id once the row has been saved. Null for a brand-new user.
   * @param {string} [fields.username]
   * @param {string} [fields.first_name]
   * @param {string} [fields.last_name]
   * @param {string} [fields.email]
   * @param {string} [fields.password_hash]  Already-hashed password. We never hold the plaintext.
   * @param {string} [fields.role]           The DB role: manager, staff, or subscriber.
   */
  constructor({ id, username, first_name, last_name, email, password_hash, role } = {}) {
    this.id            = id != null ? Number(id) : null;
    this.username      = (username || '').trim().toLowerCase();
    this.first_name    = (first_name || '').trim();
    this.last_name     = (last_name || '').trim();
    this.email         = (email || '').trim().toLowerCase();
    this.password_hash = password_hash || null;
    this.role          = (role || 'subscriber').trim().toLowerCase();
  }

  /**
   * Convenience builder for the signup route. Takes the raw req.body and
   * the already-translated DB role, and hands back a fresh User. The
   * caller still has to validate() the result - this just wires fields up
   * into a tidy object instead of leaving them as loose variables.
   *
   * @param {object} body    The Express req.body from POST /signup.
   * @param {string} dbRole  The DB role we mapped the form's account-type to.
   * @returns {User}
   */
  static fromSignupForm(body, dbRole) {
    const b = body || {};
    return new User({
      username:   b.username,
      first_name: b.first_name,
      last_name:  b.last_name,
      email:      b.email,
      role:       dbRole
    });
  }

  /**
   * Look over our own fields and report the first thing that's wrong.
   *
   * @returns {string|null} A user-friendly error message, or null if everything checks out.
   */
  validate() {
    if (!this.username || !this.first_name || !this.last_name || !this.email) {
      return 'All fields are required.';
    }
    if (!VALID_DB_ROLES.includes(this.role)) {
      return 'Choose a valid account type: Student, Manager, or Staff.';
    }
    if (!USERNAME_RE.test(this.username)) {
      return 'Username must be 3-30 characters: letters, numbers, dots, underscores, or hyphens.';
    }
    if (!EMAIL_RE.test(this.email)) {
      return 'Enter a valid email address (e.g. name@example.com).';
    }
    if (this.email.length > EMAIL_MAX_LENGTH) {
      return `Email address is too long (max ${EMAIL_MAX_LENGTH} characters).`;
    }
    return null;
  }

  /**
   * Password rules live on the User class so they're easy to find, but
   * we keep them static because a User instance only ever carries the
   * hash, never the plaintext. Call this with the raw values straight
   * off the form, before you hash anything.
   *
   * @param {string} password         The new password the user typed.
   * @param {string} confirm_password The "type it again" field.
   * @returns {string|null} An error message, or null if the password is acceptable.
   */
  static validatePassword(password, confirm_password) {
    if (!password) return 'Password is required.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!UPPERCASE_RE.test(password)) return 'Password must contain at least one uppercase letter.';
    if (!DIGIT_RE.test(password)) return 'Password must contain at least one number.';
    if (!SPECIAL_CHAR_RE.test(password)) {
      return 'Password must contain at least one special character (e.g. ! @ # $ % & *).';
    }
    if (password !== confirm_password) return 'The two passwords do not match.';
    return null;
  }

  /**
   * One trimmed, lowercased copy of the role, ready for comparison.
   * Code elsewhere (canUserSendNotifications, for example) reaches for
   * this so it doesn't have to worry about whitespace or casing.
   *
   * @returns {string}
   */
  get normalizedRole() {
    return this.role != null ? String(this.role).trim().toLowerCase() : '';
  }

  /**
   * Shape this user the way the data layer (Sequelize) wants to receive
   * it for an INSERT or UPDATE. We deliberately leave `id` off -- the
   * database generates that -- and we only include the columns the
   * users table actually has.
   *
   * @returns {{username:string, first_name:string, last_name:string, email:string, password_hash:string, role:string}}
   */
  toPersistence() {
    return {
      username:      this.username,
      first_name:    this.first_name,
      last_name:     this.last_name,
      email:         this.email,
      password_hash: this.password_hash,
      role:          this.role
    };
  }

  /**
   * The "safe to handle" version of this user. Strips password_hash and
   * anything else that shouldn't show up in views or session data --
   * basically, the fields a logged-in user is allowed to see about
   * themselves.
   *
   * @returns {{id:number|null, username:string, first_name:string, last_name:string, email:string, role:string}}
   */
  toPublic() {
    return {
      id:         this.id,
      username:   this.username,
      first_name: this.first_name,
      last_name:  this.last_name,
      email:      this.email,
      role:       this.normalizedRole
    };
  }
}

module.exports = User;
