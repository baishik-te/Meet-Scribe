
//Embeddings via raw SQL (see services/meetscribe/vectorSearchService.js)
module.exports = (sequelize, DataTypes) => {
  const DocumentChunk = sequelize.define('DocumentChunk', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    documentId: { type: DataTypes.UUID, allowNull: false },
    chunkIndex: { type: DataTypes.INTEGER, allowNull: false },
    pageNumber: { type: DataTypes.INTEGER, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    metadata: { type: DataTypes.JSONB, allowNull: true }
  }, {
    tableName: 'document_chunks',
    underscored: true
  });

  DocumentChunk.associate = (models) => {
    DocumentChunk.belongsTo(models.Document, { foreignKey: 'documentId', as: 'document' });
  };

  return DocumentChunk;
};
