/*
  Team CodeNova: Noah McGarry, Saul Bravo, Maeve Davis
  data/database.js  --  Data layer (bottom tier)

  Sequelize ORM. SQL Server access lives here as model classes
  rather than hand-written queries. Each table is mapped to a model:

    User                  -> users
    Notification          -> notifications
    NotificationRecipient -> notification_recipient (junction)

  The logic layer imports the models and the sequelize instance
  (for transactions). All parameter binding is done by Sequelize
  so SQL injection protection is preserved.
*/

const { Sequelize, DataTypes, Model, Op } = require('sequelize');
const config = require('../config');

// Sequelize instance (one per process)

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
      // Tables already exist on the server; do not let Sequelize add
      // createdAt / updatedAt or pluralize names.
      timestamps: false,
      freezeTableName: true
    }
  }
);

// Models

class User extends Model {
  /* Lowercased role for consistent role checks in the logic layer. */
  get normalizedRole() {
    return this.role != null ? String(this.role).trim().toLowerCase() : '';
  }

  /* Public profile fields (matches the old PUBLIC_FIELDS list). */
  toPublic() {
    return {
      id: this.id,
      username: this.username,
      first_name: this.first_name,
      last_name: this.last_name,
      email: this.email,
      role: this.normalizedRole
    };
  }
}

User.init(
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

class Notification extends Model {}

Notification.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    sender_email: { type: DataTypes.STRING(100), allowNull: false },
    subject: { type: DataTypes.STRING(150), allowNull: false },
    body: { type: DataTypes.TEXT, allowNull: false },
    recipient_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
  },
  { sequelize, modelName: 'Notification', tableName: 'notifications' }
);

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

// Associations - many-to-many via the junction table

Notification.belongsToMany(User, {
  through: NotificationRecipient,
  foreignKey: 'notification_id',
  otherKey: 'user_id',
  as: 'recipients'
});
User.belongsToMany(Notification, {
  through: NotificationRecipient,
  foreignKey: 'user_id',
  otherKey: 'notification_id',
  as: 'received_notifications'
});

// Initialization - proves connectivity before Express starts listening.
// Does not run sequelize.sync(); the schema is owned by the DBA (Database Administrator).

async function initialize() {
  await sequelize.authenticate();
}

module.exports = {
  sequelize,
  Op,
  User,
  Notification,
  NotificationRecipient,
  initialize
};
