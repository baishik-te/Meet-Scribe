module.exports = (sequelize, DataTypes) => {
  const Otp = sequelize.define('Otp', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    otpHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    purpose: {
      type: DataTypes.ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET'),
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'otps',
    underscored: true
  });

  Otp.associate = (models) => {
    Otp.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return Otp;
};