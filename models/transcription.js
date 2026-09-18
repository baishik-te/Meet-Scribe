module.exports = (sequelize, DataTypes) => {
  const Transcription = sequelize.define('Transcription', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    callId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    speakerId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    startTime: { type: DataTypes.STRING, allowNull: true },
    endTime: { type: DataTypes.STRING, allowNull: true }
  }, {
    tableName: 'transcriptions',
    underscored: true,
    updatedAt: false
  });

  Transcription.associate = (models) => {
    Transcription.belongsTo(models.Call, { foreignKey: 'callId', as: 'call' });
    Transcription.belongsTo(models.User, { foreignKey: 'speakerId', as: 'speaker' });
  };

  return Transcription;
};