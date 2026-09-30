'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. scheduled_calls
    await queryInterface.createTable('scheduled_calls', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      title: {
        type: Sequelize.STRING,
        allowNull: false
      },
      room_name: {
        type: Sequelize.STRING,
        allowNull: false
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: false
      },
      duration_minutes: {
        type: Sequelize.INTEGER,
        defaultValue: 30
      },
      participants: {
        type: Sequelize.JSONB,
        defaultValue: []
      },
      auto_scribe: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      status: {
        type: Sequelize.ENUM('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED'),
        defaultValue: 'UPCOMING'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // 2. user_action_items
    await queryInterface.createTable('user_action_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      call_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'calls', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      text: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      source_meeting: {
        type: Sequelize.STRING,
        allowNull: true
      },
      completed: {
        type: Sequelize.BOOLEAN,
        defaultValue: false
      },
      priority: {
        type: Sequelize.ENUM('HIGH', 'MEDIUM', 'LOW'),
        defaultValue: 'MEDIUM'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_action_items');
    await queryInterface.dropTable('scheduled_calls');
  }
};
