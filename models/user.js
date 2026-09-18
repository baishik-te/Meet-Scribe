module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true }
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('ADMIN', 'USER'),
      defaultValue: 'USER'
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    status: {
      type: DataTypes.ENUM('PENDING', 'INACTIVE', 'ACTIVE', 'SUSPENDED', 'DELETED'),
      defaultValue: 'INACTIVE'
    },
    stripeCustomerId: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'users',
    underscored: true
  });

  User.associate = (models) => {
    User.hasOne(models.Wallet, { foreignKey: 'userId', as: 'wallet' });
    User.hasMany(models.Subscription, { foreignKey: 'userId', as: 'subscriptions' });
    User.hasMany(models.TokenLedger, { foreignKey: 'userId', as: 'ledgerEntries' });
    User.hasMany(models.Otp, { foreignKey: 'userId', as: 'otps' });
  };

  return User;
};