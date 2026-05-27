/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis, Rothy Thach
  tests/User.test.js

  Unit tests for models/User.js
  Run with: npm test
*/

const User = require('../models/User');

// Constructor & Normalization

describe('User constructor', () => {

  test('trims and lowercases username and email', () => {
    const user = new User({ username: '  Noah_5000  ', email: '  Noah@Example.COM  ' });
    expect(user.username).toBe('noah_5000');
    expect(user.email).toBe('noah@example.com');
  });

  test('trims but preserves case on first_name and last_name', () => {
    const user = new User({ first_name: '  Noah  ', last_name: '  McGarry   ' });
    expect(user.first_name).toBe('Noah');
    expect(user.last_name).toBe('McGarry');
  });

  test('defaults role to "subscriber" when not provided', () => {
    const user = new User({});
    expect(user.role).toBe('subscriber');
  });

  test('converts id to a Number', () => {
    const user = new User({ id: '42' });
    expect(user.id).toBe(42);
    expect(typeof user.id).toBe('number');
  });

  test('sets id to null when not provided', () => {
    const user = new User({});
    expect(user.id).toBeNull();
  });

  test('stores password_hash as null when not provided', () => {
    const user = new User({});
    expect(user.password_hash).toBeNull();
  });

});

// validate()

describe('User.validate()', () => {

  // Helper that builds a valid user so individual tests can override one field.
  function validUser(overrides = {}) {
    return new User({
      username: 'noahmcgarry',
      first_name: 'Noah',
      last_name: 'McGarry',
      email: 'noah@example.com',
      role: 'subscriber',
      ...overrides
    });
  }

  test('returns null for a fully valid user', () => {
    expect(validUser().validate()).toBeNull();
  });

  test('returns an error when username is missing', () => {
    const user = validUser({ username: '' });
    expect(user.validate()).toBe('All fields are required.');
  });

  test('returns an error when first_name is missing', () => {
    const user = validUser({ first_name: '' });
    expect(user.validate()).toBe('All fields are required.');
  });

  test('returns an error when last_name is missing', () => {
    const user = validUser({ last_name: '' });
    expect(user.validate()).toBe('All fields are required.');
  });

  test('returns an error when email is missing', () => {
    const user = validUser({ email: '' });
    expect(user.validate()).toBe('All fields are required.');
  });

  test('returns an error for a username that is too short (< 3 chars)', () => {
    const user = validUser({ username: 'ab' });
    expect(user.validate()).toMatch(/3.30 characters/);
  });

  test('returns an error for a username that is too long (> 30 chars)', () => {
    const user = validUser({ username: 'a'.repeat(31) });
    expect(user.validate()).toMatch(/3.30 characters/);
  });

  test('returns an error for a username with invalid characters (space)', () => {
    const user = validUser({ username: 'noah mcgarry' });
    expect(user.validate()).toMatch(/3.30 characters/);
  });

  test('returns an error for a malformed email (no @)', () => {
    const user = validUser({ email: 'noahatexample.com' });
    expect(user.validate()).toMatch(/valid email/i);
  });

  test('returns an error for an email that is too long', () => {
    const user = validUser({ email: 'a'.repeat(92) + '@example.com' }); // > 100 chars
    expect(user.validate()).toMatch(/too long/i);
  });

  test('returns an error for an invalid DB role', () => {
    const user = validUser({ role: 'admin' });
    expect(user.validate()).toMatch(/valid account type/i);
  });

  test('accepts all three valid roles', () => {
    expect(validUser({ role: 'manager' }).validate()).toBeNull();
    expect(validUser({ role: 'staff' }).validate()).toBeNull();
    expect(validUser({ role: 'subscriber' }).validate()).toBeNull();
  });

});

// validatePassword()

describe('User.validatePassword()', () => {

  test('returns null for a valid password', () => {
    expect(User.validatePassword('Secret1!', 'Secret1!')).toBeNull();
  });

  test('returns an error when password is empty', () => {
    expect(User.validatePassword('', '')).toBe('Password is required.');
  });

  test('returns an error when password is shorter than 8 characters', () => {
    expect(User.validatePassword('Sec1!', 'Sec1!')).toMatch(/8 characters/);
  });

  test('returns an error when password has no uppercase letter', () => {
    expect(User.validatePassword('secret1!', 'secret1!')).toMatch(/uppercase/i);
  });

  test('returns an error when password has no digit', () => {
    expect(User.validatePassword('Secret!!', 'Secret!!')).toMatch(/number/i);
  });

  test('returns an error when password has no special character', () => {
    expect(User.validatePassword('Secret12', 'Secret12')).toMatch(/special character/i);
  });

  test('returns an error when passwords do not match', () => {
    expect(User.validatePassword('Secret1!', 'Secret2!')).toMatch(/do not match/i);
  });

});

// toPublic()

describe('User.toPublic()', () => {

  test('does not include password_hash', () => {
    const user = new User({
      id: 1, username: 'noah', first_name: 'Noah', last_name: 'McGarry',
      email: 'noah@example.com', password_hash: 'supersecret', role: 'subscriber'
    });
    expect(user.toPublic()).not.toHaveProperty('password_hash');
  });

  test('includes all expected public fields', () => {
    const user = new User({
      id: 1, username: 'noah', first_name: 'Noah', last_name: 'McGarry',
      email: 'noah@example.com', role: 'subscriber'
    });
    const pub = user.toPublic();
    expect(pub).toMatchObject({
      id: 1,
      username: 'noah',
      first_name: 'Noah',
      last_name: 'McGarry',
      email: 'noah@example.com',
      role: 'subscriber'
    });
  });

});

// toPersistence()

describe('User.toPersistence()', () => {

  test('does not include id', () => {
    const user = new User({
      id: 5, username: 'noah', first_name: 'Noah', last_name: 'McGarry',
      email: 'noah@example.com', password_hash: 'hash123', role: 'subscriber'
    });
    expect(user.toPersistence()).not.toHaveProperty('id');
  });

  test('includes password_hash', () => {
    const user = new User({ password_hash: 'hash123' });
    expect(user.toPersistence().password_hash).toBe('hash123');
  });

});

// normalizedRole getter

describe('User.normalizedRole', () => {

  test('returns a trimmed, lowercased role', () => {
    const user = new User({ role: '  Manager  ' });
    expect(user.normalizedRole).toBe('manager');
  });

});

//  fromSignupForm()

describe('User.fromSignupForm()', () => {

  test('maps form fields onto a User instance', () => {
    const body = {
      username: 'noahm',
      first_name: 'Noah',
      last_name: 'McGarry',
      email: 'noah@example.com'
    };
    const user = User.fromSignupForm(body, 'subscriber');
    expect(user.username).toBe('noahm');
    expect(user.role).toBe('subscriber');
  });

  test('handles a null body', () => {
    const user = User.fromSignupForm(null, 'staff');
    expect(user.role).toBe('staff');
    expect(user.username).toBe('');
  });

});
