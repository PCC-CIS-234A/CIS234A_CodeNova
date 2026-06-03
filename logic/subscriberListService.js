/*
  Team CodeNova: Saul Bravo
  logic/subscriberListService.js — Saul Sprint 2

  Handles subscriber lists: students pick lists, managers make lists,
  and send notification finds students on the lists that were picked.
*/

const {
  sequelize,
  Op,
  UserModel,
  SubscriberList,
  UserSubscriberList
} = require('../data/database');

const ROLE_SUBSCRIBER = 'subscriber';

/* ----- Saul Sprint 2: special list name ----- */
// This list means "email every student" when a manager sends mail
const ALL_SUBSCRIBERS_LIST_NAME = 'All Subscribers';


/* ----- Saul Sprint 2: read list ids from a form ----- */
// Checkboxes on the page send list_ids; this turns them into numbers
function parseListIdsFromBody(body) {
  if (!body) return [];
  // form may send list_ids as one value or an array
  const raw = body.list_ids ?? body.listIds ?? body.subscriber_list_id ?? body.subscriberListId;
  const values = Array.isArray(raw) ? raw : raw != null && String(raw).trim() !== '' ? [raw] : [];
  // turn strings into numbers and drop bad values
  const ids = values
    .map((v) => parseInt(String(v), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
  // remove duplicates if they checked the same list twice
  return [...new Set(ids)];
}


/* ----- Saul Sprint 2: make sure list ids are real ----- */
async function filterValidListIds(listIds) {
  if (!listIds.length) return [];
  // only keep ids that actually exist in subscriber_lists
  const rows = await SubscriberList.findAll({
    where: { id: { [Op.in]: listIds } },
    attributes: ['id']
  });
  return rows.map((r) => r.id);
}


/* ----- Saul Sprint 2: get all lists (managers) ----- */
// Newest lists first (higher id = added more recently)
async function getAllLists() {
  const rows = await SubscriberList.findAll({
    attributes: ['id', 'name'],
    order: [['id', 'DESC']]
  });
  return rows.map((r) => r.toJSON());
}


/* ----- Saul Sprint 2: lists students can join ----- */
// Students do not pick "All Subscribers" — that is for managers only
async function getCampusLists() {
  const rows = await SubscriberList.findAll({
    where: { name: { [Op.ne]: ALL_SUBSCRIBERS_LIST_NAME } },
    attributes: ['id', 'name'],
    order: [['id', 'DESC']]
  });
  return rows.map((r) => r.toJSON());
}


/* ----- Saul Sprint 2: which lists is this user on? ----- */
async function getUserListIds(userId) {
  const rows = await UserSubscriberList.findAll({
    where: { user_id: userId },
    attributes: ['list_id']
  });
  return rows.map((r) => r.list_id);
}


/* ----- Saul Sprint 2: add one list for one user ----- */
async function subscribeUserToList(userId, listId, transaction) {
  const valid = await filterValidListIds([listId]);
  if (!valid.length) {
    throw new Error('Select a valid campus subscriber list.');
  }
  await UserSubscriberList.create(
    { user_id: userId, list_id: valid[0] },
    { transaction }
  );
}


/* ----- Saul Sprint 2: save a student's list picks ----- */
// Used at signup and on the profile page
async function updateUserSubscriptions(userId, listIds, transaction) {
  const validIds = await filterValidListIds(listIds);
  const opts = transaction ? { transaction } : {};
  // wipe old rows for this user in user_list
  await UserSubscriberList.destroy({ where: { user_id: userId }, ...opts });
  if (!validIds.length) return;
  // insert one row per checked list
  await UserSubscriberList.bulkCreate(
    validIds.map((list_id) => ({ user_id: userId, list_id })),
    opts
  );
}


/* ----- Saul Sprint 2: manager adds a new list name ----- */
async function createSubscriberList(name, managerUserId) {
  const trimmed = String(name || '').trim();
  // name cannot be blank
  if (!trimmed) {
    throw new Error('List name is required.');
  }
  // name has a max length in the database
  if (trimmed.length > 100) {
    throw new Error('List name must be 100 characters or fewer.');
  }
  // do not allow two lists with the same name
  const existing = await SubscriberList.findOne({
    where: { name: trimmed },
    attributes: ['id']
  });
  if (existing) {
    throw new Error('A list with that name already exists.');
  }
  void managerUserId;
  // save the new list to subscriber_lists
  const created = await SubscriberList.create({ name: trimmed });
  return { id: created.id, name: created.name };
}


/* ----- Saul Sprint 2: manager removes one list ----- */
async function deleteSubscriberList(listId) {
  const id = parseInt(String(listId), 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Select a valid list to remove.');
  }

  const list = await SubscriberList.findByPk(id, { attributes: ['id', 'name'] });
  if (!list) {
    throw new Error('That subscriber list no longer exists.');
  }
  // All Subscribers is a built-in list — never delete it
  if (list.name === ALL_SUBSCRIBERS_LIST_NAME) {
    throw new Error('The All Subscribers list cannot be removed.');
  }

  // delete user_list links first, then the list row
  await sequelize.transaction(async (t) => {
    await UserSubscriberList.destroy({ where: { list_id: id }, transaction: t });
    await SubscriberList.destroy({ where: { id }, transaction: t });
  });

  return { name: list.name };
}


/* ----- Saul Sprint 2: manager removes several lists at once ----- */
async function deleteSubscriberLists(listIds) {
  const validIds = await filterValidListIds(listIds);
  if (!validIds.length) {
    throw new Error('Select at least one list to remove.');
  }

  const lists = await SubscriberList.findAll({
    where: { id: { [Op.in]: validIds } },
    attributes: ['id', 'name']
  });

  // block removing All Subscribers even if it was checked
  if (lists.some((list) => list.name === ALL_SUBSCRIBERS_LIST_NAME)) {
    throw new Error('The All Subscribers list cannot be removed.');
  }

  if (!lists.length) {
    throw new Error('Select at least one valid list to remove.');
  }

  const ids = lists.map((list) => list.id);
  // delete all picked lists and their user_list links in one transaction
  await sequelize.transaction(async (t) => {
    await UserSubscriberList.destroy({ where: { list_id: { [Op.in]: ids } }, transaction: t });
    await SubscriberList.destroy({ where: { id: { [Op.in]: ids } }, transaction: t });
  });

  return { names: lists.map((list) => list.name), count: lists.length };
}


/* ----- Saul Sprint 2: who gets the email? ----- */
// Manager picked list ids on send notification; find those students
async function getSubscribersForLists(listIds) {
  const validIds = await filterValidListIds(listIds);
  if (!validIds.length) return [];

  // load the list names so we can check for All Subscribers
  const selectedLists = await SubscriberList.findAll({
    where: { id: { [Op.in]: validIds } },
    attributes: ['id', 'name']
  });
  const includesAllSubscribers = selectedLists.some(
    (list) => list.name === ALL_SUBSCRIBERS_LIST_NAME
  );

  // All Subscribers = every student with an email
  if (includesAllSubscribers) {
    const rows = await UserModel.findAll({
      where: {
        role: ROLE_SUBSCRIBER,
        email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
      },
      attributes: ['id', 'email']
    });
    return rows;
  }

  // otherwise find students who joined any of the picked lists
  const rows = await UserModel.findAll({
    where: {
      role: ROLE_SUBSCRIBER,
      email: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] }
    },
    include: [{
      model: SubscriberList,
      as: 'subscriber_lists',
      where: { id: { [Op.in]: validIds } },
      attributes: [],
      through: { attributes: [] },
      required: true
    }],
    attributes: ['id', 'email']
  });

  // Same student on two lists should only get one email
  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

/* ----- end Saul Sprint 2 ----- */

// export functions so logic.js and app.js can use them
module.exports = {
  ALL_SUBSCRIBERS_LIST_NAME,
  parseListIdsFromBody,
  filterValidListIds,
  getAllLists,
  getCampusLists,
  getUserListIds,
  subscribeUserToList,
  updateUserSubscriptions,
  createSubscriberList,
  deleteSubscriberList,
  deleteSubscriberLists,
  getSubscribersForLists
};
