/*
  data/database.js  -  Data Layer

  Owns the SQLite database and every SQL statement in the app.
  The logic layer calls these functions.
*/

const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = path.join(__dirname, 'app.db');
const db = new Database(DB_FILE);

// Recommended pragmas for a typical web app: WAL gives better
// concurrency, and foreign keys are off by default in SQLite
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Creates the user table on first run.
async function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT    NOT NULL UNIQUE,
      first_name    TEXT    NOT NULL,
      last_name     TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      role          TEXT    NOT NULL DEFAULT 'student'
    )
  `);
}

// User table queries

const PUBLIC_FIELDS = 'id, username, first_name, last_name, email, role';

async function findUserById(id) {
  return db.prepare(`SELECT ${PUBLIC_FIELDS} FROM user WHERE id = ?`).get(id);
}

async function findUserByUsername(username) {
  return db.prepare('SELECT id FROM user WHERE username = ?').get(username);
}

async function findUserByEmail(email) {
  return db.prepare('SELECT id FROM user WHERE email = ?').get(email);
}

// Used at login, identifier may be a username or an email
async function findCredentialsByIdentifier(identifier) {
  return db
    .prepare('SELECT id, password_hash FROM user WHERE username = ? OR lower(email) = ?')
    .get(identifier, identifier);
}

async function createUser({ username, first_name, last_name, email, password_hash, role = 'student' }) {
  const result = db.prepare(
    `INSERT INTO user (username, first_name, last_name, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?, ?)`
  ).run(username, first_name, last_name, email, password_hash, role);
  return result.lastInsertRowid;
}

module.exports = {
  initializeDatabase,
  findUserById,
  findUserByUsername,
  findUserByEmail,
  findCredentialsByIdentifier,
  createUser
};
