/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis
  data/database.js  —  Data layer (bottom tier)

  All SQL Server access for this app lives here.
  The logic layer calls these functions;

*/

const sql = require('mssql');
const config = require('../config');

// ---------------------------------------------------------------------------
// Connection pool
// Holds the promise for the first successful connect();
// ---------------------------------------------------------------------------

let poolPromise;

/** Ensures DB_SERVER and DB_NAME are set before we try to connect. */
function assertDbConfigured() {
  const { server, database } = config.db;
  if (!server || !database) {
    throw new Error('Database not configured: set DB_SERVER and DB_NAME in .env.');
  }
}

/**
 * Maps .env into the format the mssql driver expects.
 * encrypt / trustServerCertificate matter for PCC
 */
function buildPoolConfig() {
  const { server, user, password, database, port, encrypt, trustServerCertificate } = config.db;
  return {
    user,
    password,
    server,
    database,
    port,
    options: {
      encrypt,
      trustServerCertificate
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
  };
}

/** Returns the shared pool, creating and connecting it on first call. */
async function getPool() {
  assertDbConfigured();
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(buildPoolConfig()).connect();
  }
  return poolPromise;
}

/**
 * Called from server.js at startup: proves we can reach SQL Server before
 * Express starts listening. Fails fast if credentials or network are wrong.
 *
 */
async function initializeDatabase() {
  const pool = await getPool();
  await pool.request().query('SELECT 1 AS ok');
}

// ---------------------------------------------------------------------------
// Users — signup, login
// ---------------------------------------------------------------------------

const PUBLIC_FIELDS = 'id, username, first_name, last_name, email, role';

/** Lowercase role for consistent checks. */
function normalizeUserRow(row) {
  if (!row) return undefined;
  const raw = row.role != null ? row.role : row.Role;
  if (raw != null) row.role = String(raw).trim().toLowerCase();
  return row;
}

/** Full public profile by primary key */
async function findUserById(id) {
  const pool = await getPool();
  const result = await pool
      .request()
      .input('id', sql.Int, Number(id))
      .query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = @id`);
  return normalizeUserRow(result.recordset[0]);
}

/** Returns {id} if username is taken */
async function findUserByUsername(username) {
  const pool = await getPool();
  const result = await pool
      .request()
      .input('username', sql.NVarChar(50), username)
      .query('SELECT id FROM users WHERE username = @username');
  return result.recordset[0] || undefined;
}

/** Returns { id } if email is already registered. */
async function findUserByEmail(email) {
  const pool = await getPool();
  const result = await pool
      .request()
      .input('email', sql.NVarChar(100), email)
      .query('SELECT id FROM users WHERE email = @email');
  return result.recordset[0] || undefined;
}

/**
 * Login lookup: identifier is either username or email
 */
async function findCredentialsByIdentifier(identifier) {
  const pool = await getPool();
  const result = await pool
      .request()
      .input('id', sql.NVarChar(100), identifier)
      .query(
          `SELECT id, password_hash FROM users
       WHERE LOWER(username) = LOWER(@id) OR LOWER(email) = LOWER(@id)`
      );
  return result.recordset[0] || undefined;
}

/**
 * Inserts a new user after signup. returns the new numeric `id`.
 * Runs in a transaction. if the row’s role does not match what we sent (e.g. a
 * trigger or default forced `subscriber`), we roll back so no bad row remains.
 */
async function createUser({ username, first_name, last_name, email, password_hash, role = 'subscriber' }) {
  const pool = await getPool();
  const dbRole = String(role || 'subscriber').trim().toLowerCase();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const ins = await new sql.Request(transaction)
        .input('username', sql.NVarChar(50), username)
        .input('first_name', sql.NVarChar(50), first_name)
        .input('last_name', sql.NVarChar(50), last_name)
        .input('email', sql.NVarChar(100), email)
        .input('password_hash', sql.NVarChar(255), password_hash)
        .input('db_role', sql.NVarChar(30), dbRole)
        .query(`
        INSERT INTO users (username, first_name, last_name, email, password_hash, [role])
        OUTPUT INSERTED.id AS id
        VALUES (@username, @first_name, @last_name, @email, @password_hash, @db_role)
      `);
    const id = ins.recordset[0].id;

    /* catches AFTER INSERT triggers */
    const chk = await new sql.Request(transaction)
        .input('id', sql.Int, id)
        .query('SELECT [role] AS r FROM users WHERE id = @id');
    const saved = String(chk.recordset[0].r != null ? chk.recordset[0].r : '').trim().toLowerCase();
    if (saved !== dbRole) {
      throw new Error(
          `Database stored role "${chk.recordset[0].r}" instead of "${dbRole}". ` +
          'Remove or fix triggers/defaults on users.role, or widen CHECK constraints.'
      );
    }
    await transaction.commit();
    return id;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * DEV ONLY — find or create a placeholder test user for the given role.
 * Used by the developer bypass button on /login so we can preview the
 * post-login screens without typing credentials. The password_hash stored
 * here will never match a real password (random junk), so the account
 * cannot be logged into through the normal /login form.
 */
async function findOrCreateDevUser(role) {
  const dbRole = String(role || 'subscriber').trim().toLowerCase();
  const username = `dev_${dbRole}`;
  const email = `${username}@dev.local`;
  const first_name = 'Dev';
  const last_name = dbRole.charAt(0).toUpperCase() + dbRole.slice(1);

  const existing = await findUserByUsername(username);
  if (existing) return existing.id;

  // Use a non-functional placeholder; bcrypt.compare will never match.
  const password_hash = '$2b$12$devbypassNEVERmatchesANYrealPASSWORDxxxxxxxxxxxxxxxxxxxx';
  return createUser({
    username,
    first_name,
    last_name,
    email,
    password_hash,
    role: dbRole
  });
}

// ---------------------------------------------------------------------------
// Notifications — sends emails to recipients + audit trail
// ---------------------------------------------------------------------------

/**
 * Who should receive the email. every user whose `role` is in the list and
 * who has a usable email. Used by logic to build the BCC list.
 */
async function getUserEmailsByRoles(roles) {
  if (!roles || roles.length === 0) return [];
  const pool = await getPool();
  const request = pool.request();
  const placeholders = roles.map((_, i) => `@role${i}`).join(', ');
  roles.forEach((r, i) => {
    request.input(`role${i}`, sql.NVarChar(30), r);
  });
  const result = await request.query(`
    SELECT id, email
    FROM users
    WHERE role IN (${placeholders})
      AND email IS NOT NULL
      AND LTRIM(RTRIM(email)) <> ''
  `);
  return result.recordset;
}

/**
 * After SMTP succeeds, one row in `notifications`, then one junction row per
 * recipient. Wrapped in a transaction so we don’t leave a half-written send.
 */
async function saveNotificationWithRecipients({ senderEmail, subject, body, recipientUserIds }) {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    // Parent row (recipient_count matches how many BCCs we actually mailed).
    const ins = await new sql.Request(transaction)
        .input('sender', sql.NVarChar(100), senderEmail.slice(0, 100))
        .input('subject', sql.NVarChar(150), subject.slice(0, 150))
        .input('body', sql.NVarChar(sql.MAX), body)
        .input('count', sql.Int, recipientUserIds.length)
        .query(`
        INSERT INTO notifications (sender_email, subject, body, recipient_count)
        OUTPUT INSERTED.id AS id
        VALUES (@sender, @subject, @body, @count)
      `);
    const notificationId = ins.recordset[0].id;

    // one line per user id that was included in the BCC list.
    for (const userId of recipientUserIds) {
      await new sql.Request(transaction)
          .input('nid', sql.Int, notificationId)
          .input('uid', sql.Int, userId)
          .query(`
          INSERT INTO notification_recipient (notification_id, user_id)
          VALUES (@nid, @uid)
        `);
    }
    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Public API (only these are imported elsewhere)
// ---------------------------------------------------------------------------
module.exports = {
  initializeDatabase,
  findUserById,
  findUserByUsername,
  findUserByEmail,
  findCredentialsByIdentifier,
  createUser,
  findOrCreateDevUser,
  getUserEmailsByRoles,
  saveNotificationWithRecipients
};