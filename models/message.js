module.exports = (sequelize, DataTypes) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
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
