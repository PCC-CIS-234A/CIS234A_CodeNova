/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis
  models/User.js

  This is the representation of a user in our app.
  It holds the fields a user has and checks them for validity.

  The logic layer builds one of these from a signup form,
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
  constructor({ id, username, first_name, last_name, email, password_hash, role } = {}) {
    this.id            = id != null ? Number(id) : null;
    this.username      = (username || '').trim().toLowerCase();
    this.first_name    = (first_name || '').trim();
    this.last_name     = (last_name || '').trim();
    this.email         = (email || '').trim().toLowerCase();
    this.password_hash = password_hash || null;
    this.role          = (role || 'subscriber').trim().toLowerCase();
  }

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

  static validatePassword(password, confirm_password) {
    if (!password) return 'Password is required.';

    const missing = [];
    if (password.length < 8)              missing.push('at least 8 characters');
    if (!UPPERCASE_RE.test(password))     missing.push('one uppercase letter');
    if (!DIGIT_RE.test(password))         missing.push('one number');
    if (!SPECIAL_CHAR_RE.test(password))  missing.push('one special character (e.g. ! @ # $ % & *)');

    if (missing.length > 0) {
      return 'Password must contain ' + missing.join(', ') + '.';
    }

    if (password !== confirm_password) return 'The two passwords do not match.';
    return null;
  }

  get normalizedRole() {
    return this.role != null ? String(this.role).trim().toLowerCase() : '';
  }

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
