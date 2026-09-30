module.exports = (sequelize, DataTypes) => {
  const ChatMessage = sequelize.define('ChatMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    documentId: { type: DataTypes.UUID, allowNull: false },
    role: {
      type: DataTypes.ENUM('user', 'assistant'),
      allowNull: false
    },
    message: { type: DataTypes.TEXT, allowNull: false },
    sources: { type: DataTypes.JSONB, allowNull: true },
    // Uploaded files associated with this user message. Stored as safe
    // metadata only; the physical files/vectors remain in the document session.
    attachments: { type: DataTypes.JSONB, allowNull: true }
  }, {
    tableName: 'chat_messages',
    underscored: true,
    updatedAt: false
  });

  ChatMessage.associate = (models) => {
    ChatMessage.belongsTo(models.Document, { foreignKey: 'documentId', as: 'document' });
    ChatMessage.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
  };

  return ChatMessage;
};
