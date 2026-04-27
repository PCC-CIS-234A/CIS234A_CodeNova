/*
  logic/logic.js  -  Logic Layer

  Business rules for signup and login: input validation, password
  hashing, and the workflow that ties them together. Talks to the
  data layer.

  User-facing problems are thrown as `AuthError`, the application
  layer turns those into flash messages.
*/

const bcrypt = require('bcryptjs');
const db = require('../data/database');

const SALT_ROUNDS = 12;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,30}$/;

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

  if (!username || !first_name || !last_name || !email || !password) {
    throw new AuthError('All fields are required.');
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

  if (await db.findUserByUsername(username)) {
    throw new AuthError('That username is already taken.');
  }
  if (await db.findUserByEmail(email)) {
    throw new AuthError('An account with that email already exists.');
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  const userId = await db.createUser({
    username, first_name, last_name, email, password_hash
  });

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

module.exports = { AuthError, signup, login, getCurrentUser };
