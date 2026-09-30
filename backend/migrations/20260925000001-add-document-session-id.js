'use strict';

// Multi-document chat sessions.
//
// A "session" is anchored by the first document a user uploads; that anchor
// document's own id is the session id. Supplementary files uploaded into the
// same chat are stored as their own `documents` rows but carry `session_id`
// pointing at the anchor. Their chunks and chat messages are stored under the
// anchor's id so RAG retrieval and chat history span every file in the session.
//
// This migration is purely additive (a nullable column + index) and reversible.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('documents', 'session_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'documents', key: 'id' },
      onDelete: 'CASCADE',
    });

    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS documents_session_id_idx ON documents(session_id);
    `);

    // Backfill: existing documents are their own session anchor.
    await queryInterface.sequelize.query(`
      UPDATE documents SET session_id = id WHERE session_id IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS documents_session_id_idx;');
    await queryInterface.removeColumn('documents', 'session_id');
  },
};
