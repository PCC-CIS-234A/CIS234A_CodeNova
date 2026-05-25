/**
 * Unit tests — Sprint 1 Send Notification (access / sender validation)
 * Run: npm test
 */
require('dotenv').config();

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const logic = require('../logic/logic');

describe('Send Notification validation', () => {
  it('canUserSendNotifications returns true for manager', () => {
    const user = { role: 'manager' };
    assert.equal(logic.canUserSendNotifications(user), true);
  });

  it('canUserSendNotifications returns false for subscriber', () => {
    const user = { role: 'subscriber' };
    assert.equal(logic.canUserSendNotifications(user), false);
  });

  it('mayAccessSendNotification returns true for manager request', () => {
    const req = {
      currentUser: { role: 'manager', first_name: 'Pat', last_name: 'Lee', email: 'p@example.com' },
      session: {}
    };
    assert.equal(logic.mayAccessSendNotification(req), true);
  });

  it('mayAccessSendNotification returns false with no user and no dev bypass', () => {
    const req = { currentUser: null, session: {} };
    assert.equal(logic.mayAccessSendNotification(req), false);
  });

  it('resolveBroadcastSender throws AuthError when not authorized', () => {
    const req = { currentUser: null, session: {} };
    assert.throws(
      () => logic.resolveBroadcastSender(req),
      (err) => err.name === 'AuthError' && /Not authorized/.test(err.message)
    );
  });
});
