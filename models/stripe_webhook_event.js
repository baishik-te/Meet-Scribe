module.exports = (sequelize, DataTypes) => {
  const StripeWebhookEvent = sequelize.define('StripeWebhookEvent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    eventId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    eventType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('PROCESSING', 'PROCESSED', 'FAILED'),
      defaultValue: 'PROCESSING'
    }
  }, {
    tableName: 'stripe_webhook_events',
    underscored: true
  });

  return StripeWebhookEvent;
};