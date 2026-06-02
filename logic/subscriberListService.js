/*
  Team CodeNova: Saul Bravo
  logic/subscriberListService.js — Saul Sprint 2

  Business rules for subscriber lists: default campus lists, student
  subscriptions, manager-created lists, and resolving recipients when
  sending notifications to one or more lists.
*/

const {
  sequelize,
  Op,
  UserModel,
  SubscriberList,
  UserSubscriberList
} = require('../data/database');

const ROLE_SUBSCRIBER = 'subscriber';

/** Existing DB list used for manager broadcast-to-everyone (Saul Sprint 2). */
const ALL_SUBSCRIBERS_LIST_NAME = 'All Subscribers';

/**
 * Read list id values from a POST body (checkboxes or a single radio).
 * @param {object} body
 * @returns {number[]}
 */
function parseListIdsFromBody(body) {
  if (!body) return [];
  const raw = body.list_ids ?? body.listIds ?? body.subscriber_list_id ?? body.subscriberListId;
  const values = Array.isArray(raw) ? raw : raw != null && String(raw).trim() !== '' ? [raw] : [];
  const ids = values
    .map((v) => parseInt(String(v), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
  return [...new Set(ids)];
}

/**
 * Keep only list ids that exist in the database.
 * @param {number[]} listIds
 * @returns {Promise<number[]>}
 */
async function filterValidListIds(listIds) {
  if (!listIds.length) return [];
  const rows = await SubscriberList.findAll({
    where: { id: { [Op.in]: listIds } },
    attributes: ['id']
  });
  return rows.map((r) => r.id);
}

/**
 * All subscriber lists from the existing subscriber_lists table.
 * @returns {Promise<Array<{id:number, name:string}>>}
 */
async function getAllLists() {
  const rows = await SubscriberList.findAll({
    attributes: ['id', 'name'],
    order: [['name', 'ASC']]
  });
  return rows.map((r) => r.toJSON());
}

/**
 * Campus and manager-created lists students can join (excludes All Subscribers).
 * @returns {Promise<Array<{id:number, name:string}>>}
 */
async function getCampusLists() {
  const rows = await SubscriberList.findAll({
    where: { name: { [Op.ne]: ALL_SUBSCRIBERS_LIST_NAME } },
    attributes: ['id', 'name'],
    order: [['name', 'ASC']]
  });
  return rows.map((r) => r.toJSON());
}

/**
 * List ids a user is currently subscribed to.
 * @param {number} userId
 * @returns {Promise<number[]>}
 */
async function getUserListIds(userId) {
  const rows = await UserSubscriberList.findAll({
    where: { user_id: userId },
    attributes: ['list_id']
  });
  return rows.map((r) => r.list_id);
}

/**
 * Subscribe a student to a single list (used at signup).
 * @param {number} userId
 * @param {number} listId
 * @param {import('sequelize').Transaction} [transaction]
 * @returns {Promise<void>}
 */
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

/**
 * Replace a student's list subscriptions (signup and profile).
 * @param {number} userId
 * @param {number[]} listIds
 * @param {import('sequelize').Transaction} [transaction]
 * @returns {Promise<void>}
 */
async function updateUserSubscriptions(userId, listIds, transaction) {
  const validIds = await filterValidListIds(listIds);
  const opts = transaction ? { transaction } : {};
  await UserSubscriberList.destroy({ where: { user_id: userId }, ...opts });
  if (!validIds.length) return;
  await UserSubscriberList.bulkCreate(
    validIds.map((list_id) => ({ user_id: userId, list_id })),
    opts
  );
}

/**
 * Manager creates a new subscriber list.
 * @param {string} name
 * @param {number} managerUserId
 * @returns {Promise<{id:number, name:string}>}
 */
async function createSubscriberList(name, managerUserId) {
  const trimmed = String(name || '').trim();
  if (!trimmed) {
    throw new Error('List name is required.');
  }
  if (trimmed.length > 100) {
    throw new Error('List name must be 100 characters or fewer.');
  }
  const existing = await SubscriberList.findOne({
    where: { name: trimmed },
    attributes: ['id']
  });
  if (existing) {
    throw new Error('A list with that name already exists.');
  }
  void managerUserId;
  const created = await SubscriberList.create({ name: trimmed });
  return { id: created.id, name: created.name };
}

/**
 * Manager removes a subscriber list and its user subscriptions (Saul Sprint 2).
 * @param {number} listId
 * @returns {Promise<{name:string}>}
 */
async function deleteSubscriberList(listId) {
  const id = parseInt(String(listId), 10);
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error('Select a valid list to remove.');
  }

  const list = await SubscriberList.findByPk(id, { attributes: ['id', 'name'] });
  if (!list) {
    throw new Error('That subscriber list no longer exists.');
  }
  if (list.name === ALL_SUBSCRIBERS_LIST_NAME) {
    throw new Error('The All Subscribers list cannot be removed.');
  }

  await sequelize.transaction(async (t) => {
    await UserSubscriberList.destroy({ where: { list_id: id }, transaction: t });
    await SubscriberList.destroy({ where: { id }, transaction: t });
  });

  return { name: list.name };
}

/**
 * Find subscriber-role users on the selected lists (deduped by user id).
 * @param {number[]} listIds
 * @returns {Promise<Array<{id:number, email:string}>>}
 */
async function getSubscribersForLists(listIds) {
  const validIds = await filterValidListIds(listIds);
  if (!validIds.length) return [];

  const selectedLists = await SubscriberList.findAll({
    where: { id: { [Op.in]: validIds } },
    attributes: ['id', 'name']
  });
  const includesAllSubscribers = selectedLists.some(
    (list) => list.name === ALL_SUBSCRIBERS_LIST_NAME
  );

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

  const seen = new Set();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

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
  getSubscribersForLists
};
