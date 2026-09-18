module.exports = (sequelize, DataTypes) => {
  const Plan = sequelize.define('Plan', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stripeProductId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stripePriceId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(10),
      defaultValue: 'usd'
    },
    monthlyTokenQuota: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    videoRatePerMinute: {
      type: DataTypes.INTEGER,
      defaultValue: 2
    },
    recordingRatePerMinute: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    transcriptionRatePerMinute: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    geminiRatePerRequest: {
      type: DataTypes.INTEGER,
      defaultValue: 5
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'ARCHIVED'),
      defaultValue: 'ACTIVE'
    }
  }, {
    tableName: 'plans',
    underscored: true
  });

  Plan.associate = (models) => {
    Plan.hasMany(models.Subscription, { foreignKey: 'planId', as: 'subscriptions' });
  };

  return Plan;
};