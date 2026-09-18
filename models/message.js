module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    // The accepted connection this message belongs to (1:1 chat thread).
    connectionId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    senderId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    receiverId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    // When the receiver has read the message. NULL = unread.
    readAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'messages',
    underscored: true
  });

  Message.associate = (models) => {
    Message.belongsTo(models.Connection, { foreignKey: 'connectionId', as: 'connection' });
    Message.belongsTo(models.User, { foreignKey: 'senderId', as: 'sender' });
    Message.belongsTo(models.User, { foreignKey: 'receiverId', as: 'receiver' });
  };

  return Message;
};
