const { sequelize } = require('../../models');

function toVectorLiteral(embedding) {
  return `[${embedding.join(',')}]`;
}

/** Insert one chunk + its embedding via raw SQL (pgvector ::vector cast). */
async function saveChunk({ documentId, chunkIndex, pageNumber, content, embedding, metadata }) {
  await sequelize.query(
    `INSERT INTO document_chunks
       (document_id, chunk_index, page_number, content, embedding, metadata)
     VALUES
       (:documentId, :chunkIndex, :pageNumber, :content, :embedding::vector, :metadata::jsonb)`,
    {
      replacements: {
        documentId,
        chunkIndex,
        pageNumber: pageNumber ?? null,
        content,
        embedding: toVectorLiteral(embedding),
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    }
  );
}

/**
 * Cosine nearest-neighbour search, scoped to a single document AND its owner so
 * one user's chunks never surface in another user's answer (metadata filtering).
 * Returns rows with { id, document_id, page_number, content, similarity }.
 */
async function searchChunks({ userId, documentId, queryEmbedding, limit = 5 }) {
  const rows = await sequelize.query(
    `SELECT c.id, c.document_id, c.page_number, c.content,
            c.metadata->>'sourceFileName' AS source_file_name,
            1 - (c.embedding <=> :queryEmbedding::vector) AS similarity
       FROM document_chunks c
       JOIN documents d ON d.id = c.document_id
      WHERE c.document_id = :documentId
        AND d.user_id = :userId
      ORDER BY c.embedding <=> :queryEmbedding::vector
      LIMIT :limit`,
    {
      replacements: { queryEmbedding: toVectorLiteral(queryEmbedding), documentId, userId, limit },
      type: sequelize.QueryTypes.SELECT,
    }
  );
  return rows;
}

/**
 * Remove vectors belonging to one physical file from its session anchor.
 * Supplementary-file chunks are stored under the anchor document_id, so a
 * normal document cascade cannot remove them when the child row is deleted.
 */
async function deleteChunksForSourceDocument({ sessionId, sourceDocumentId }) {
  await sequelize.query(
    `DELETE FROM document_chunks
      WHERE document_id = :sessionId
        AND metadata->>'sourceDocumentId' = :sourceDocumentId`,
    { replacements: { sessionId, sourceDocumentId } }
  );
}

module.exports = {
  saveChunk,
  searchChunks,
  deleteChunksForSourceDocument,
};
