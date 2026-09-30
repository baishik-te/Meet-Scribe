'use strict';

// MeetScribe AI (RAG PDF-chat)
module.exports = {
  async up(queryInterface, Sequelize) {
    
    await queryInterface.createTable('documents', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      file_name: { type: Sequelize.STRING, allowNull: false },
      file_path: { type: Sequelize.STRING, allowNull: false },
      mime_type: { type: Sequelize.STRING, allowNull: true },
      file_size: { type: Sequelize.INTEGER, allowNull: true },
      status: {
        type: Sequelize.ENUM('PROCESSING', 'READY', 'FAILED'),
        allowNull: false,
        defaultValue: 'PROCESSING'
      },
      page_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      chunk_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      error: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.sequelize.query(`
      CREATE TABLE document_chunks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        chunk_index INTEGER NOT NULL,
        page_number INTEGER,
        content TEXT NOT NULL,
        embedding VECTOR(1536) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX document_chunks_document_id_idx ON document_chunks(document_id);
    `);

    // Approximate nearest-neighbour index using cosine distance.
    await queryInterface.sequelize.query(`
      CREATE INDEX document_chunks_embedding_hnsw_idx
      ON document_chunks USING hnsw (embedding vector_cosine_ops);
    `);

    // chat_messages 
    await queryInterface.createTable('chat_messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      document_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'documents', key: 'id' },
        onDelete: 'CASCADE'
      },
      role: {
        type: Sequelize.ENUM('user', 'assistant'),
        allowNull: false
      },
      message: { type: Sequelize.TEXT, allowNull: false },
      sources: { type: Sequelize.JSONB, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.sequelize.query(`
      CREATE INDEX chat_messages_document_id_idx ON chat_messages(document_id);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('chat_messages');
    await queryInterface.sequelize.query('DROP TABLE IF EXISTS document_chunks;');
    await queryInterface.dropTable('documents');
    // Drop the enum types created by createTable for the ENUM columns.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_documents_status";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_chat_messages_role";');
  }
};
