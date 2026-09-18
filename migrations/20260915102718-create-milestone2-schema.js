'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('connections', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      requester_id: {
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
      status: {
        type: Sequelize.ENUM('PENDING', 'ACCEPTED', 'REJECTED', 'BLOCKED'),
        defaultValue: 'PENDING',
        allowNull: false
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('calls', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true
      },
      room_name: { type: Sequelize.STRING, allowNull: false, unique: true },
      caller_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
      },
      receiver_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
      },
      status: {
        type: Sequelize.ENUM('CREATED', 'RINGING', 'ACTIVE', 'ENDED', 'FAILED', 'TERMINATED_LOW_BALANCE'),
        defaultValue: 'CREATED'
      },
      started_at: { type: Sequelize.DATE, allowNull: true },
      ended_at: { type: Sequelize.DATE, allowNull: true },
      duration_seconds: { type: Sequelize.INTEGER, defaultValue: 0 },
      video_enabled: { type: Sequelize.BOOLEAN, defaultValue: true },
      recording_enabled: { type: Sequelize.BOOLEAN, defaultValue: false },
      transcription_enabled: { type: Sequelize.BOOLEAN, defaultValue: false },
      last_billed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('recordings', {
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
      egress_id: { type: Sequelize.STRING, allowNull: true },
      storage_url: { type: Sequelize.STRING, allowNull: true },
      storage_provider: { type: Sequelize.STRING, defaultValue: 's3' },
      started_at: { type: Sequelize.DATE, allowNull: false },
      ended_at: { type: Sequelize.DATE, allowNull: true },
      duration_seconds: { type: Sequelize.INTEGER, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM('STARTING', 'ACTIVE', 'STOPPED', 'FAILED'),
        defaultValue: 'STARTING'
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('transcriptions', {
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
      speaker_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' }
      },
      text: { type: Sequelize.TEXT, allowNull: false },
      start_time: { type: Sequelize.STRING, allowNull: true },
      end_time: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('transcriptions');
    await queryInterface.dropTable('recordings');
    await queryInterface.dropTable('calls');
    await queryInterface.dropTable('connections');
  }
};