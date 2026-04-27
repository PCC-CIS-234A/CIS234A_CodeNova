/*
  application/app.js  -  Application Layer

  Builds the Express app and defines every HTTP route. Each route's
  job is to read the request, ask the logic layer to do the work,
  and render a view or redirect.

  No SQL, no bcrypt, no validation rules live here
*/

const path = require('path');
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const helmet = require('helmet');

const logic = require('../logic/logic');
const { AuthError } = logic;

const app = express();

// view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// global middleware
app.use(helmet());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));
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
    const user = await logic.getCurrentUser(req.session.userId);
    if (user) {
      req.currentUser = user;
      res.locals.currentUser = user;
    } else {
      req.session.userId = null;
    }
    next();
  } catch (error) { next(error); }
});

// Routes

app.get('/', (req, res) => {
  res.render('home', { title: 'Home' });
});

// signup
app.get('/signup', (req, res) => {
  if (req.currentUser) return res.redirect('/');
  res.render('signup', { title: 'Create Account', form: {} });
});

app.post('/signup', async (req, res, next) => {
  const form = {
    username: (req.body.username || '').trim().toLowerCase(),
    first_name: (req.body.first_name || '').trim(),
    last_name: (req.body.last_name || '').trim(),
    email: (req.body.email || '').trim().toLowerCase()
  };
  try {
    const { userId, first_name } = await logic.signup(req.body);
    req.session.userId = userId;
    req.flash('success', `Welcome, ${first_name}!`);
    res.redirect('/');
  } catch (error) {
    if (error instanceof AuthError) {
      req.flash('error', error.message);
      return res.render('signup', { title: 'Create Account', form });
    }
    next(error);
  }
});

// login
app.get('/login', (req, res) => {
  if (req.currentUser) return res.redirect('/');
  res.render('login', { title: 'Log In', form: {} });
});

app.post('/login', async (req, res, next) => {
  const form = { identifier: (req.body.identifier || '').trim().toLowerCase() };
  try {
    const { userId } = await logic.login(req.body);
    req.session.userId = userId;
    res.redirect('/');
  } catch (error) {
    if (error instanceof AuthError) {
      req.flash('error', error.message);
      return res.render('login', { title: 'Log In', form });
    }
    next(error);
  }
});

// logout
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// 404
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

module.exports = app;
