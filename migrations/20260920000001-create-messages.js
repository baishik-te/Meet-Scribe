'use strict';

// Direct 1:1 chat messages exchanged between two connected users. Additive
// only — no existing table is modified. A message belongs to an accepted
// connection thread and records sender/receiver plus an optional read timestamp.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('messages', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      connection_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'connections', key: 'id' },
        onDelete: 'CASCADE'
      },
      sender_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      receiver_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      body: { type: Sequelize.TEXT, allowNull: false },
      read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.addIndex('messages', ['connection_id', 'created_at']);
    await queryInterface.addIndex('messages', ['receiver_id', 'read_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('messages');
  }
};
