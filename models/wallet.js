module.exports = (sequelize, DataTypes) => {
  const Wallet = sequelize.define('Wallet', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    currentTokenBalance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 }
    }
  }, {
    tableName: 'wallets',
    underscored: true
  });

  Wallet.associate = (models) => {
    Wallet.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Wallet;
};