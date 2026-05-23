/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis
  application/app.js  -  Application Layer (top tier)

  Builds the Express app and defines every HTTP route. Each route's
  job is to read the request, ask the logic layer to do the actual
  work, and then either render a view or redirect.

  No SQL, no bcrypt, no validation rules live in here. If something
  feels like business logic, it belongs in logic/logic.js instead.
*/

const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');

const logic = require('../logic/logic');
const { AuthError } = logic;

const app = express();

// -- View engine

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// -- Global middleware
// Order matters: helmet first for security headers, then body parsing,
// static files, session, and flash. The user-loader below depends on
// the session, so it has to come after session().

app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false
}));
app.use(flash());

/**
 * On every request: pull any flash messages onto res.locals so the
 * views can show them, and if there's a userId in the session, load
 * that user and attach the safe public shape as both req.currentUser
 * (for routes) and res.locals.currentUser (for views).
 *
 * If the session points at a user that no longer exists -- we deleted
 * them, the DB was wiped, etc. -- we clear the session id and just
 * carry on as if they were logged out.
 */
app.use(async (req, res, next) => {
  res.locals.currentUser = null;
  res.locals.messages = {
    success: req.flash('success'),
    error: req.flash('error')
  };
  if (!req.session.userId) return next();
  try {
    const user = await logic.getCurrentUser(req.session.userId);
    if (user) {
      req.currentUser = user;
      res.locals.currentUser = user;
    } else {
      // Stale session pointing at a deleted user. Drop the id so they
      // get a clean "logged out" state for the rest of this request.
      req.session.userId = null;
    }
    next();
  } catch (error) { next(error); }
});

// -- Routes

/** Home page -- public, always available. */
app.get('/', (req, res) => {
  res.render('home', { title: 'Home' });
});

// ---- Signup

/** Render the signup form. If they're already logged in, send them home. */
app.get('/signup', (req, res) => {
  if (req.currentUser) return res.redirect('/');
  res.render('signup', { title: 'Create Account', form: {} });
});

/**
 * Handle a signup submission. We pull a "sticky form" copy of the
 * fields up front so we can re-render the form with the user's input
 * preserved if anything fails validation.
 */
app.post('/signup', async (req, res, next) => {
  const form = {
    username: (req.body.username || '').trim().toLowerCase(),
    first_name: (req.body.first_name || '').trim(),
    last_name: (req.body.last_name || '').trim(),
    email: (req.body.email || '').trim().toLowerCase()
  };
  try {
    const { first_name } = await logic.signup(req.body);
    // Deliberately does NOT auto-log them in. They go to a confirmation
    // page and have to explicitly log in with the credentials they
    // just chose. It's a nice gentle check that they remember them.
    req.flash('success', `Account created successfully${first_name ? ', ' + first_name : ''}!`);
    res.redirect('/signup/success');
  } catch (error) {
    if (error instanceof AuthError) {
      res.locals.messages.error = [error.message];
      return res.render('signup', { title: 'Create Account', form });
    }
    next(error);
  }
});

/** Confirmation page shown after a successful signup. */
app.get('/signup/success', (req, res) => {
  if (req.currentUser) return res.redirect('/');
  res.render('signup-success', { title: 'Account Created' });
});

// ---- Login

/** Render the login form. Already-logged-in users get sent home. */
app.get('/login', (req, res) => {
  if (req.currentUser) return res.redirect('/');
  res.render('login', { title: 'Log In', form: {} });
});

/**
 * Handle a login submission. On success, stash the user id in the
 * session and send them home. On failure, re-render with the
 * identifier they typed so they don't have to retype it.
 */
app.post('/login', async (req, res, next) => {
  const form = { identifier: (req.body.identifier || '').trim().toLowerCase() };
  try {
    const { userId } = await logic.login(req.body);
    req.session.userId = userId;
    res.redirect('/');
  } catch (error) {
    if (error instanceof AuthError) {
      res.locals.messages.error = [error.message];
      return res.render('login', { title: 'Log In', form });
    }
    next(error);
  }
});

// ---- Logout

/** Destroy the session entirely and send them home as a guest. */
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// -- 404 fallback
// Has to be the last middleware. If nothing above matched, this
// catches it and renders the friendly Not Found page.
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

module.exports = app;
