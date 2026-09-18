module.exports = (sequelize, DataTypes) => {
  const Connection = sequelize.define('Connection', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    requesterId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    receiverId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED'),
      defaultValue: 'PENDING'
    }
  }, {
    tableName: 'connections',
    underscored: true
  });

  Connection.associate = (models) => {
    Connection.belongsTo(models.User, { foreignKey: 'requesterId', as: 'requester' });
    Connection.belongsTo(models.User, { foreignKey: 'receiverId', as: 'receiver' });
  };

  return Connection;
};