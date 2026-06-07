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
    req.flash('error', 'Only managers and staff can send notifications.');
    return res.redirect('/');
  }
  try {
    /* ----- Saul Sprint 2: send notification list checkboxes ----- */
    // get every list name from the database for the checkbox area
    const subscriberLists = await logic.subscriberListService.getAllLists();
    // show the send form with an empty subject/body and the list checkboxes
    res.render('sendNotification', { title: 'Send Notification', form: {}, subscriberLists });
  } catch (error) {
    next(error);
  }
});

app.post('/sendNotification', async (req, res) => {
  if (!logic.mayAccessSendNotification(req)) {
    if (!req.currentUser) return res.redirect('/login');
    req.flash('error', 'Only managers and staff can send notifications.');
    return res.redirect('/');
  }

  const subject = (req.body.subject || '').trim();
  const body = (req.body.body || '').trim();

  // read which list checkboxes were checked on the form
  const selectedListIds = logic.subscriberListService.parseListIdsFromBody(req.body);
  // keep subject, body, and list picks if we have to show the form again
  const form = { subject, body, selectedListIds };

  // subject and message body are required
  if (!subject || !body) {
    res.locals.messages.error = ['Subject and message body are required.'];
    const subscriberLists = await logic.subscriberListService.getAllLists();
    return res.render('sendNotification', { title: 'Send Notification', form, subscriberLists });
  }

  // manager must pick at least one list to send to
  if (!selectedListIds.length) {
    res.locals.messages.error = ['Select at least one subscriber list.'];
    const subscriberLists = await logic.subscriberListService.getAllLists();
    return res.render('sendNotification', { title: 'Send Notification', form, subscriberLists });
  }

  try {
    const { senderName, senderUsername, senderEmail } = logic.resolveBroadcastSender(req);
    // email only students on the lists that were checked
    await logic.sendBroadcastNotification({
      subject,
      body,
      senderName,
      senderUsername,
      senderEmail,
      listIds: selectedListIds
    });
    req.flash('success', 'Notification email sent.');
    return res.redirect('/sendNotification');
  } catch (error) {
    // show error and put their typed data back on the form
    res.locals.messages.error = [error.message || 'Could not send notification email.'];
    const subscriberLists = await logic.subscriberListService.getAllLists();
    return res.render('sendNotification', { title: 'Send Notification', form, subscriberLists });
  }
});

/* ----- end Saul Sprint 2 ----- */

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

// ---- SIGNUP

/** Render the signup form. If they're already logged in, send them home. */
app.get('/signup', async (req, res, next) => {
  if (req.currentUser) return res.redirect('/');
  try {
    /* ----- Saul Sprint 2: signup list checkboxes ----- */
    // load campus lists (not All Subscribers) for student checkboxes
    const subscriberLists = await logic.subscriberListService.getCampusLists();
    // show signup form with empty fields and the list picker
    res.render('signup', { title: 'Create Account', form: {}, subscriberLists });
  } catch (error) {
    next(error);
  }
});

/**
 * Handle a signup submission.
 */
app.post('/signup', async (req, res, next) => {
  const form = {
    username: (req.body.username || '').trim().toLowerCase(),
    first_name: (req.body.first_name || '').trim(),
    last_name: (req.body.last_name || '').trim(),
    email: (req.body.email || '').trim().toLowerCase(),

    // remember account type and checked lists if signup fails
    signup_role: logic.pickSignupRoleFromBody(req.body),
    selectedListIds: logic.subscriberListService.parseListIdsFromBody(req.body)
  };
  try {
    const { first_name } = await logic.signup(req.body);
    req.flash('success', `Account created successfully${first_name ? ', ' + first_name : ''}!`);
    res.redirect('/signup/success');
  } catch (error) {
    if (error instanceof AuthError) {
      res.locals.messages.error = [error.message];
      // reload lists so checkboxes still show after a validation error
      const subscriberLists = await logic.subscriberListService.getCampusLists();
      return res.render('signup', { title: 'Create Account', form, subscriberLists });
    }
    next(error);
  }
});

/* ----- end Saul Sprint 2 ----- */

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

// Show profile page (student subscriptions or manager list tools)
app.get('/profile', async (req, res, next) => {
  // must be logged in to see profile
  if (!req.currentUser) return res.redirect('/login');
  try {
    // load lists and which ones this student already joined
    const profile = await logic.getProfileData(req.currentUser);
    res.render('profile', {
      title: 'Profile',
      profile
    });
  } catch (error) {
    next(error);
  }
});

// Student saves which lists they want on profile
app.post('/profile/subscriptions', async (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  const role = String(req.currentUser.role || '').trim().toLowerCase();
  // only students can change their list subscriptions
  if (role !== 'subscriber') {
    req.flash('error', 'Only students can manage list subscriptions.');
    return res.redirect('/profile');
  }

  // read checked boxes from the form
  const listIds = logic.subscriberListService.parseListIdsFromBody(req.body);
  try {
    // replace old picks in user_list with the new checked ones
    await logic.updateStudentSubscriptions(req.currentUser.id, listIds);
    req.flash('success', 'Your subscriptions were updated.');
  } catch (error) {
    req.flash('error', error.message || 'Could not update subscriptions.');
  }
  return res.redirect('/profile');
});

// Manager adds a new list name
app.post('/profile/lists', async (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  // only managers can create lists
  if (!logic.canUserManageSubscriberLists(req.currentUser)) {
    req.flash('error', 'Only managers can create subscriber lists.');
    return res.redirect('/profile');
  }

  const listName = (req.body.list_name || '').trim();
  try {
    // add a new row to subscriber_lists
    await logic.createManagerSubscriberList(listName, req.currentUser.id);
    req.flash('success', `Subscriber list "${listName}" created.`);
  } catch (error) {
    req.flash('error', error.message || 'Could not create subscriber list.');
  }
  return res.redirect('/profile');
});

// Manager removes checked lists
app.post('/profile/lists/delete', async (req, res) => {
  if (!req.currentUser) return res.redirect('/login');
  // only managers can delete lists
  if (!logic.canUserManageSubscriberLists(req.currentUser)) {
    req.flash('error', 'Only managers can remove subscriber lists.');
    return res.redirect('/profile');
  }

  // read which list checkboxes were checked for removal
  const listIds = logic.subscriberListService.parseListIdsFromBody(req.body);
  try {
    // delete lists and remove students from those lists in user_list
    const { names, count } = await logic.deleteManagerSubscriberLists(listIds);
    // show a message for one list or many lists
    if (count === 1) {
      req.flash('success', `Subscriber list "${names[0]}" removed.`);
    } else {
      req.flash('success', `${count} subscriber lists removed.`);
    }
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
