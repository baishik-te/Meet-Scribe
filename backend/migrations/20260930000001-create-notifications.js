'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if table already exists
    const tableInfo = await queryInterface.tableExists('notifications');
    if (!tableInfo) {
      await queryInterface.createTable('notifications', {
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
        type: {
          type: Sequelize.STRING,
          allowNull: false
        },
        title: {
          type: Sequelize.STRING,
          allowNull: false
        },
        message: {
          type: Sequelize.TEXT,
          allowNull: false
        },
        data: {
          type: Sequelize.JSONB,
          defaultValue: {}
        },
        read: {
          type: Sequelize.BOOLEAN,
          defaultValue: false
        },
        read_at: {
          type: Sequelize.DATE,
          allowNull: true
        },
        created_at: {
          type: Sequelize.DATE,
          allowNull: false
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false
        }
      });

      await queryInterface.addIndex('notifications', ['user_id', 'created_at']);
      await queryInterface.addIndex('notifications', ['user_id', 'read']);
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  }
};
