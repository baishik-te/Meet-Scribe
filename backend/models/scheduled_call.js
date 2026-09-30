module.exports = (sequelize, DataTypes) => {
  const ScheduledCall = sequelize.define('ScheduledCall', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    roomName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      defaultValue: 30
    },
    participants: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    autoScribe: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    status: {
      type: DataTypes.ENUM('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'),
      defaultValue: 'UPCOMING'
    }
  }, {
    tableName: 'scheduled_calls',
    underscored: true
  });

  ScheduledCall.associate = (models) => {
    ScheduledCall.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return ScheduledCall;
};
