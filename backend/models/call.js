module.exports = (sequelize, DataTypes) => {
  const Call = sequelize.define('Call', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    roomName: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    callerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    receiverId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('CREATED', 'RINGING', 'ACTIVE', 'ENDED', 'FAILED', 'TERMINATED_LOW_BALANCE'),
      defaultValue: 'CREATED'
    },
    startedAt: { type: DataTypes.DATE, allowNull: true },
    endedAt: { type: DataTypes.DATE, allowNull: true },
    durationSeconds: { type: DataTypes.INTEGER, defaultValue: 0 },
    videoEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    recordingEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    transcriptionEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    lastBilledAt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'calls',
    underscored: true
  });

  Call.associate = (models) => {
    Call.belongsTo(models.User, { foreignKey: 'callerId', as: 'caller' });
    Call.belongsTo(models.User, { foreignKey: 'receiverId', as: 'receiver' });
    Call.hasMany(models.Recording, { foreignKey: 'callId', as: 'recordings' });
    Call.hasMany(models.Transcription, { foreignKey: 'callId', as: 'transcriptions' });
    Call.hasMany(models.Summary, { foreignKey: 'callId', as: 'summaries' });
  };

  return Call;
};