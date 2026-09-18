module.exports = (sequelize, DataTypes) => {
  const Summary = sequelize.define('Summary', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    callId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    model: { type: DataTypes.STRING, allowNull: true }
  }, {
    tableName: 'summaries',
    underscored: true
  });

  Summary.associate = (models) => {
    Summary.belongsTo(models.Call, { foreignKey: 'callId', as: 'call' });
    Summary.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Summary;
};
