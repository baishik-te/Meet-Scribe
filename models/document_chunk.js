// NOTE: the `embedding VECTOR(1536)` column is intentionally NOT declared here.
// Sequelize has no native pgvector type, so embeddings are written and queried
// via raw SQL (see services/meetscribe/vectorSearchService.js). This model is
// used for listing/counting/deleting chunk metadata only.
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
