module.exports = (sequelize, DataTypes) => {
  const UserActionItem = sequelize.define('UserActionItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    callId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    sourceMeeting: {
      type: DataTypes.STRING,
      allowNull: true
    },
    completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    priority: {
      type: DataTypes.ENUM('HIGH', 'MEDIUM', 'LOW'),
      defaultValue: 'MEDIUM'
    }
  }, {
    tableName: 'user_action_items',
    underscored: true
  });

  UserActionItem.associate = (models) => {
    UserActionItem.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    UserActionItem.belongsTo(models.Call, { foreignKey: 'callId', as: 'call' });
  };

  return UserActionItem;
};
