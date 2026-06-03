/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis
  data/database.js  --  Data layer (bottom tier)

  Sequelize ORM. SQL Server access lives here as model classes rather
  than scattered raw queries. Each table maps to one model:

    UserModel              -> users
    Notification           -> notifications
    NotificationRecipient  -> notification_recipient (junction)
    SubscriberList         -> subscriber_lists (Saul Sprint 2)
    UserSubscriberList     -> user_list (Saul Sprint 2)

  The logic layer imports these models (plus the sequelize instance,
  for transactions) and does its work through them. All parameter
  binding goes through Sequelize, so SQL injection protection
  functions automatically.

  The plain JS "User" domain class lives in models/User.js. This
  file's UserModel is specifically the Sequelize-backed table row.
*/

const { Sequelize, DataTypes, Model, Op } = require('sequelize');
const config = require('../config');

// -- Sequelize instance (one per process) ---------------------------------

/**
 * Fail fast at startup if the .env file doesn't have the DB pieces we
 * need. Without these the connection will hang or error in a much less
 * helpful way later on.
 */
function assertDbConfigured() {
  const { server, database } = config.db;
  if (!server || !database) {
    throw new Error('Database not configured: set DB_SERVER and DB_NAME in .env.');
  }
}

assertDbConfigured();

const sequelize = new Sequelize(
  config.db.database,
  config.db.user,
  config.db.password,
  {
    host: config.db.server,
    port: config.db.port,
    dialect: 'mssql',
    dialectOptions: {
      options: {
        encrypt: config.db.encrypt,
        trustServerCertificate: config.db.trustServerCertificate
      }
    },
    pool: { max: 10, min: 0, idle: 30000 },
    logging: false,
    define: {
      // The tables already exist on the server; don't let Sequelize
      // add createdAt / updatedAt or pluralize names behind our back.
      timestamps: false,
      freezeTableName: true
    }
  }
);

// -- Models ---------------------------------------------------------------

/**
 * Sequelize-backed row from the users table. This class is the data
 * layer's view of a user -- it knows about the columns and how to read
 * and write them. For domain logic (validation, shaping for views, etc.)
 * use the plain User class in models/User.js instead.
 */
class UserModel extends Model {}

UserModel.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
    first_name: { type: DataTypes.STRING(50), allowNull: false },
    last_name: { type: DataTypes.STRING(50), allowNull: false },
    email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'subscriber' }
  },
  { sequelize, modelName: 'User', tableName: 'users' }
);

/**
 * One outgoing notification: who sent it, what they said, and how many
 * people received a copy. The actual list of recipients lives in the
 * NotificationRecipient junction so we can answer "who got this?" later.
 */
class Notification extends Model {}

Notification.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sender_email: { type: DataTypes.STRING(100), allowNull: false },
    subject: { type: DataTypes.STRING(150), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    recipient_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    // allowNull omitted intentionally — the DB column has DEFAULT GETDATE()
    // and we never pass sent_at on INSERT, so SQL Server sets it automatically.
    sent_at: { type: DataTypes.DATE }
  },
  { sequelize, modelName: 'Notification', tableName: 'notifications' }
);

/**
 * Junction table connecting users and notifications. A composite primary
 * key of (notification_id, user_id) means a given user can appear at
 * most once per notification, which is exactly what we want.
 */
class NotificationRecipient extends Model {}

NotificationRecipient.init(
  {
    notification_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: 'notifications', key: 'id' }
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: 'users', key: 'id' }
    }
  },
  { sequelize, modelName: 'NotificationRecipient', tableName: 'notification_recipient' }
);

/* ----- Saul Sprint 2: database models for subscriber lists ----- */
/* subscriber_lists table = list names (campus names, etc.) */

class SubscriberList extends Model {}

// map subscriber_lists table columns
SubscriberList.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true }
  },
  { sequelize, modelName: 'SubscriberList', tableName: 'subscriber_lists' }
);

/* user_list table = which student joined which list */

class UserSubscriberList extends Model {}

// map user_list table — links user_id to list_id
UserSubscriberList.init(
  {
    list_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: 'subscriber_lists', key: 'id' }
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true,
      references: { model: 'users', key: 'id' }
    }
  },
  { sequelize, modelName: 'UserSubscriberList', tableName: 'user_list' }
);

/* ----- end Saul Sprint 2 ----- */

// -- Associations
// Many-to-many in both directions, going through the junction table.
// `as` lets the logic layer reach for notification.recipients or
// user.received_notifications when it needs to eager-load.

Notification.belongsToMany(UserModel, {
  through: NotificationRecipient,
  foreignKey: 'notification_id',
  otherKey: 'user_id',
  as: 'recipients'
});
UserModel.belongsToMany(Notification, {
  through: NotificationRecipient,
  foreignKey: 'user_id',
  otherKey: 'notification_id',
  as: 'received_notifications'
});

/* ----- Saul Sprint 2: link users to lists in the database ----- */

// a user can be on many lists through user_list
UserModel.belongsToMany(SubscriberList, {
  through: UserSubscriberList,
  foreignKey: 'user_id',
  otherKey: 'list_id',
  as: 'subscriber_lists'
});
// a list can have many users through user_list
SubscriberList.belongsToMany(UserModel, {
  through: UserSubscriberList,
  foreignKey: 'list_id',
  otherKey: 'user_id',
  as: 'subscribers'
});

/* ----- end Saul Sprint 2 ----- */

// -- Initialization

/**
 * Prove we can actually reach the database before Express starts
 * listening. We do NOT run sequelize.sync() - the schema is owned by
 * the DBA, and the app should not be inventing tables on its own.
 *
 * @returns {Promise<void>} Resolves once the connection is good.
 */
async function initialize() {
  await sequelize.authenticate();
}

module.exports = {
  sequelize,
  Op,
  UserModel,
  Notification,
  NotificationRecipient,
  SubscriberList,
  UserSubscriberList,
  initialize
};
