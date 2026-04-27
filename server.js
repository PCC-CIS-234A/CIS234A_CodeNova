/*

Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis

Noah McGarry - Account Creation/Login 4/26/2026

Express + EJS + MySQL. Sessions for login state, bcrypt for password
hashing, flash for messages

  npm install
  npm start    # http://localhost:5000

*/

const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const helmet = require('helmet');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3306;
const SALT_ROUNDS = 12;
const USERNAME_RE = /^[A-Za-z0-9._-]{3,30}$/;

// database
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// run() executes INSERT/UPDATE/DELETE/DDL
const run = async (sql, params = []) => {
  const [result] = await pool.execute(sql, params);
  return { lastID: result.insertId, affectedRows: result.affectedRows };
};
// get() returns the first row of a SELECT, or undefined if none.
const get = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows[0];
};

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(30) NOT NULL UNIQUE,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'student'
    )
  `);
}

// middleware
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

// Loads the current user and flash messages onto every response
app.use(async (req, res, next) => {
  res.locals.currentUser = null;
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error')
  };
  if (!req.session.userId) return next();
  try {
    const user = await get(
      'SELECT id, username, first_name, last_name, email, role FROM user WHERE id = ?',
      [req.session.userId]
    );
    if (user) {
      req.currentUser = user;
      res.locals.currentUser = user;
    } else {
      req.session.userId = null;
    }
    next();
  } catch (error) { next(error); }
});

// routes
app.get('/', (req, res) => {
  res.render('home', { title: 'Home' });
});

// signup
app.get('/signup', (req, res) => {
  if (req.currentUser) return res.redirect('/');
  res.render('signup', { title: 'Create Account', form: {} });
});

app.post('/signup', async (req, res, next) => {
  const username = (req.body.username || '').trim().toLowerCase();
  const first_name = (req.body.first_name || '').trim();
  const last_name = (req.body.last_name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const confirm_password = req.body.confirm_password || '';
  const form = { username, first_name, last_name, email };

  const fail = (msg) => {
    req.flash('error', msg);
    res.render('signup', { title: 'Create Account', form });
  };

  if (!username || !first_name || !last_name || !email || !password) {
    return fail('All fields are required.');
  }
  if (!USERNAME_RE.test(username)) {
    return fail('Username must be 3-30 characters: letters, numbers, dots, underscores, or hyphens.');
  }
  if (password.length < 8) return fail('Password must be at least 8 characters.');
  if (password !== confirm_password) return fail('The two passwords do not match.');

  try {
    if (await get('SELECT id FROM user WHERE username = ?', [username])) {
      return fail('That username is already taken.');
    }
    if (await get('SELECT id FROM user WHERE email = ?', [email])) {
      return fail('An account with that email already exists.');
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await run(
      `INSERT INTO user (username, first_name, last_name, email, password_hash, role)
         VALUES (?, ?, ?, ?, ?, 'student')`,
      [username, first_name, last_name, email, password_hash]
    );

    req.session.userId = result.lastID;
    req.flash('success', `Welcome, ${first_name}!`);
    res.redirect('/');
  } catch (error) { next(error); }
});

// login
app.get('/login', (req, res) => {
  if (req.currentUser) return res.redirect('/');
  res.render('login', { title: 'Log In', form: {} });
});

app.post('/login', async (req, res, next) => {
  const identifier = (req.body.identifier || '').trim().toLowerCase();
  const password = req.body.password || '';
  const form = { identifier };

  const fail = (msg) => {
    req.flash('error', msg);
    res.render('login', { title: 'Log In', form });
  };

  if (!identifier || !password) return fail('Both fields are required.');

  try {
    const user = await get(
      'SELECT id, password_hash FROM user WHERE username = ? OR lower(email) = ?',
      [identifier, identifier]
    );
    // Compare against a dummy hash when no user is found so timing
    // doesn't reveal whether the identifier exists
    const dummy = '$2b$12$0123456789012345678901abcdefabcdefabcdefabcdefabcdefab';
    const ok = await bcrypt.compare(password, user ? user.password_hash : dummy);

    if (!user || !ok) return fail('Invalid username/email or password.');

    req.session.userId = user.id;
    res.redirect('/');
  } catch (error) { next(error); }
});

// logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// start
initializeDatabase()
  .then(() => app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  }))
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
