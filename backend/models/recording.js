module.exports = (sequelize, DataTypes) => {
  const Recording = sequelize.define('Recording', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    callId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    name: { type: DataTypes.STRING, allowNull: true },
    egressId: { type: DataTypes.STRING, allowNull: true },
    storageUrl: { type: DataTypes.STRING, allowNull: true },
    storageProvider: { type: DataTypes.STRING, defaultValue: 's3' },
    startedAt: { type: DataTypes.DATE, allowNull: false },
    endedAt: { type: DataTypes.DATE, allowNull: true },
    durationSeconds: { type: DataTypes.INTEGER, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM('STARTING', 'ACTIVE', 'STOPPED', 'FAILED'),
      defaultValue: 'STARTING'
    }
  }, {
    tableName: 'recordings',
    underscored: true
  });

  Recording.associate = (models) => {
    Recording.belongsTo(models.Call, { foreignKey: 'callId', as: 'call' });
  };

  return Recording;
};