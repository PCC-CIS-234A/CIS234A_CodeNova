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
/* ----- Saul's code ----- */
const config = require('../config');
const notificationRoutes = require('./notificationRoutes');
/* ----- end Saul's code ----- */

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
  /* ----- Saul's code: dev bypass flags for Send Notification ----- */
  res.locals.devBypassAvailable = config.app.devBypassNotifications;
  res.locals.devBypassActive = !!(config.app.devBypassNotifications && req.session.devBypass);
  /* ----- end Saul's code ----- */
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

/* ----- Saul's code: Send Notification routes ----- */
app.get('/sendNotification', async (req, res, next) => {
  if (!logic.mayAccessSendNotification(req)) {
    if (!req.currentUser) return res.redirect('/login');
    req.flash('error', 'Only managers can send notifications.');
    return res.redirect('/');
  }
  try {
    /* ----- Saul Sprint 2: load subscriber lists for multi-list send ----- */
    const subscriberLists = await logic.subscriberListService.getAllLists();
    res.render('sendNotification', { title: 'Send Notification', form: {}, subscriberLists });
    /* ----- end Saul Sprint 2 ----- */
  } catch (error) {
    next(error);
  }
});

app.post('/sendNotification', async (req, res) => {
  if (!logic.mayAccessSendNotification(req)) {
    if (!req.currentUser) return res.redirect('/login');
    req.flash('error', 'Only managers can send notifications.');
    return res.redirect('/');
  }

  const subject = (req.body.subject || '').trim();
  const body = (req.body.body || '').trim();
  /* ----- Saul Sprint 2: preserve selected list ids on validation errors ----- */
  const selectedListIds = logic.subscriberListService.parseListIdsFromBody(req.body);
  const form = { subject, body, selectedListIds };
  /* ----- end Saul Sprint 2 ----- */

  if (!subject || !body) {
    res.locals.messages.error = ['Subject and message body are required.'];
    const subscriberLists = await logic.subscriberListService.getAllLists();
    return res.render('sendNotification', { title: 'Send Notification', form, subscriberLists });
  }

  if (!selectedListIds.length) {
    res.locals.messages.error = ['Select at least one subscriber list.'];
    const subscriberLists = await logic.subscriberListService.getAllLists();
    return res.render('sendNotification', { title: 'Send Notification', form, subscriberLists });
  }

  try {
    const { senderName, senderEmail } = logic.resolveBroadcastSender(req);
    await logic.sendBroadcastNotification({
      subject,
      body,
      senderName,
      senderEmail,
      listIds: selectedListIds
    });
    req.flash('success', 'Notification email sent.');
    return res.redirect('/sendNotification');
  } catch (error) {
    res.locals.messages.error = [error.message || 'Could not send notification email.'];
    const subscriberLists = await logic.subscriberListService.getAllLists();
    return res.render('sendNotification', { title: 'Send Notification', form, subscriberLists });
  }
});

app.get('/dev-bypass', (req, res) => {
  if (!config.app.devBypassNotifications) {
    req.flash('error', 'Dev bypass is not enabled on this server.');
    return res.redirect('/login');
  }
  if (req.currentUser) return res.redirect('/sendNotification');
  req.session.devBypass = true;
  res.redirect('/sendNotification');
});
/* ----- Maeve's code: Notification log route ----- */
app.use('/notifications', notificationRoutes);
/* ----- end Maeve's code ----- */

// ---- Signup

/** Render the signup form. If they're already logged in, send them home. */
app.get('/signup', async (req, res, next) => {
  if (req.currentUser) return res.redirect('/');
  try {
    /* ----- Saul Sprint 2: pass subscriber lists for student campus radios ----- */
    const subscriberLists = await logic.subscriberListService.getCampusLists();
    res.render('signup', { title: 'Create Account', form: {}, subscriberLists });
    /* ----- end Saul Sprint 2 ----- */
  } catch (error) {
    next(error);
  }
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
    email: (req.body.email || '').trim().toLowerCase(),
    /* ----- Saul Sprint 2: preserve account type and list selections ----- */
    signup_role: logic.pickSignupRoleFromBody(req.body),
    selectedListIds: logic.subscriberListService.parseListIdsFromBody(req.body)
    /* ----- end Saul Sprint 2 ----- */
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
      const subscriberLists = await logic.subscriberListService.getCampusLists();
      return res.render('signup', { title: 'Create Account', form, subscriberLists });
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
    // Clear any leftover dev-bypass flag so a real login never shows
    // the dev-bypass banner or inherits bypass-mode access.
    delete req.session.devBypass;
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

/* ----- Saul Sprint 2: profile routes ----- */
app.get('/profile', async (req, res, next) => {
  if (!req.currentUser) return res.redirect('/login');
  try {
    const profile = await logic.getProfileData(req.currentUser);
    res.render('profile', {
      title: 'Profile',
      profile
    });
  } catch (error) {
    next(error);
  }
});

app.post('/profile/subscriptions', async (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  const role = String(req.currentUser.role || '').trim().toLowerCase();
  if (role !== 'subscriber') {
    req.flash('error', 'Only students can manage list subscriptions.');
    return res.redirect('/profile');
  }

  const listIds = logic.subscriberListService.parseListIdsFromBody(req.body);
  try {
    await logic.updateStudentSubscriptions(req.currentUser.id, listIds);
    req.flash('success', 'Your subscriptions were updated.');
  } catch (error) {
    req.flash('error', error.message || 'Could not update subscriptions.');
  }
  return res.redirect('/profile');
});

app.post('/profile/lists', async (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  if (!logic.canUserSendNotifications(req.currentUser)) {
    req.flash('error', 'Only managers can create subscriber lists.');
    return res.redirect('/profile');
  }

  const listName = (req.body.list_name || '').trim();
  try {
    await logic.createManagerSubscriberList(listName, req.currentUser.id);
    req.flash('success', `Subscriber list "${listName}" created.`);
  } catch (error) {
    req.flash('error', error.message || 'Could not create subscriber list.');
  }
  return res.redirect('/profile');
});

app.post('/profile/lists/delete', async (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  if (!logic.canUserSendNotifications(req.currentUser)) {
    req.flash('error', 'Only managers can remove subscriber lists.');
    return res.redirect('/profile');
  }

  const listId = req.body.list_id;
  try {
    const { name } = await logic.deleteManagerSubscriberList(listId);
    req.flash('success', `Subscriber list "${name}" removed.`);
  } catch (error) {
    req.flash('error', error.message || 'Could not remove subscriber list.');
  }
  return res.redirect('/profile');
});
/* ----- end Saul Sprint 2 ----- */

// -- 404 fallback
// Has to be the last middleware. If nothing above matched, this
// catches it and renders the friendly Not Found page.
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

module.exports = app;
