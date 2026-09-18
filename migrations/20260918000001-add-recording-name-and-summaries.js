'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Editable, user-facing name for a saved recording.
    await queryInterface.addColumn('recordings', 'name', {
      type: Sequelize.STRING,
      allowNull: true
    });

    // 2. Gemini-generated summaries of a call's transcript. One row per
    //    generation; the latest (by created_at) is treated as current.
    await queryInterface.createTable('summaries', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      call_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'calls', key: 'id' },
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
      },
      content: { type: Sequelize.TEXT, allowNull: false },
      model: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('summaries');
    await queryInterface.removeColumn('recordings', 'name');
  }
};
