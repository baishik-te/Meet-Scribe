module.exports = (sequelize, DataTypes) => {
  const TokenLedger = sequelize.define('TokenLedger', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    transactionType: {
      type: DataTypes.ENUM(
        'SUBSCRIPTION_CREDIT',
        'PRO_RATED_UPGRADE',
        'MANUAL_CREDIT',
        'REFUND',
        'VIDEO_USAGE',
        'RECORDING_USAGE',
        'TRANSCRIPTION_USAGE',
        'GEMINI_USAGE',
        'SUBSCRIPTION_EXPIRATION',
        'ADMIN_ADJUSTMENT'
      ),
      allowNull: false
    },
    balanceBefore: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    balanceAfter: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    featureReference: {
      type: DataTypes.STRING,
      allowNull: true
    },
    referenceId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'token_ledger',
    underscored: true,
    updatedAt: false
  });

  TokenLedger.associate = (models) => {
    TokenLedger.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return TokenLedger;
};