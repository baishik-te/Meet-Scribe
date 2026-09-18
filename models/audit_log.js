module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    actorUserId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false
    },
    entityType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    entityId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    oldValue: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    newValue: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'audit_logs',
    underscored: true,
    updatedAt: false
  });

  return AuditLog;
};