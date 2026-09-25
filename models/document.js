module.exports = (sequelize, DataTypes) => {
  const Document = sequelize.define('Document', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: { type: DataTypes.UUID, allowNull: false },
    // Session anchor: the id of the first document in this chat session.
    // Null is treated as "this document is its own session anchor".
    sessionId: { type: DataTypes.UUID, allowNull: true },
    isChatAttachment: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    fileName: { type: DataTypes.STRING, allowNull: false },
    filePath: { type: DataTypes.STRING, allowNull: false },
    mimeType: { type: DataTypes.STRING, allowNull: true },
    fileSize: { type: DataTypes.INTEGER, allowNull: true },
    status: {
      type: DataTypes.ENUM('PROCESSING', 'READY', 'FAILED'),
      defaultValue: 'PROCESSING'
    },
    pageCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    chunkCount: { type: DataTypes.INTEGER, defaultValue: 0 },
    error: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'documents',
    underscored: true
  });

  Document.associate = (models) => {
    Document.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Document.hasMany(models.DocumentChunk, { foreignKey: 'documentId', as: 'chunks' });
    Document.hasMany(models.ChatMessage, { foreignKey: 'documentId', as: 'messages' });
    // Session grouping: an anchor document has many supplementary documents.
    Document.belongsTo(models.Document, { foreignKey: 'sessionId', as: 'session' });
    Document.hasMany(models.Document, { foreignKey: 'sessionId', as: 'sessionFiles' });
  };

  return Document;
};
