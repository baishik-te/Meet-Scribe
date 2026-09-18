'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('uuid_generate_v4()'), primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.ENUM('ADMIN', 'USER'), defaultValue: 'USER' },
      email_verified: { type: Sequelize.BOOLEAN, defaultValue: false },
      status: { type: Sequelize.ENUM('PENDING', 'ACTIVE', 'SUSPENDED', 'DELETED'), defaultValue: 'PENDING' },
      stripe_customer_id: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('otps', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('uuid_generate_v4()'), primaryKey: true },
      user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      email: { type: Sequelize.STRING, allowNull: false },
      otp_hash: { type: Sequelize.STRING, allowNull: false },
      purpose: { type: Sequelize.ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET'), allowNull: false },
      expires_at: { type: Sequelize.DATE, allowNull: false },
      attempts: { type: Sequelize.INTEGER, defaultValue: 0 },
      verified_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('plans', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('uuid_generate_v4()'), primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      stripe_product_id: { type: Sequelize.STRING, allowNull: false },
      stripe_price_id: { type: Sequelize.STRING, allowNull: false },
      price: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      currency: { type: Sequelize.STRING(10), defaultValue: 'usd' },
      monthly_token_quota: { type: Sequelize.INTEGER, allowNull: false },
      video_rate_per_minute: { type: Sequelize.INTEGER, defaultValue: 2 },
      recording_rate_per_minute: { type: Sequelize.INTEGER, defaultValue: 1 },
      transcription_rate_per_minute: { type: Sequelize.INTEGER, defaultValue: 1 },
      gemini_rate_per_request: { type: Sequelize.INTEGER, defaultValue: 5 },
      status: { type: Sequelize.ENUM('ACTIVE', 'ARCHIVED'), defaultValue: 'ACTIVE' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('subscriptions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('uuid_generate_v4()'), primaryKey: true },
      user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      plan_id: { type: Sequelize.UUID, references: { model: 'plans', key: 'id' } },
      stripe_subscription_id: { type: Sequelize.STRING, allowNull: false, unique: true },
      stripe_customer_id: { type: Sequelize.STRING, allowNull: false },
      stripe_price_id: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.ENUM('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'INCOMPLETE', 'PAUSED'), defaultValue: 'ACTIVE' },
      current_period_start: { type: Sequelize.DATE, allowNull: false },
      current_period_end: { type: Sequelize.DATE, allowNull: false },
      cancel_at_period_end: { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('wallets', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('uuid_generate_v4()'), primaryKey: true },
      user_id: { type: Sequelize.UUID, unique: true, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      current_token_balance: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('token_ledger', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('uuid_generate_v4()'), primaryKey: true },
      user_id: { type: Sequelize.UUID, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      amount: { type: Sequelize.INTEGER, allowNull: false },
      transaction_type: { 
        type: Sequelize.ENUM(
          'SUBSCRIPTION_CREDIT', 'PRO_RATED_UPGRADE', 'MANUAL_CREDIT', 'REFUND',
          'VIDEO_USAGE', 'RECORDING_USAGE', 'TRANSCRIPTION_USAGE', 'GEMINI_USAGE',
          'SUBSCRIPTION_EXPIRATION', 'ADMIN_ADJUSTMENT'
        ),
        allowNull: false
      },
      balance_before: { type: Sequelize.INTEGER, allowNull: false },
      balance_after: { type: Sequelize.INTEGER, allowNull: false },
      feature_reference: { type: Sequelize.STRING, allowNull: true },
      reference_id: { type: Sequelize.STRING, allowNull: true },
      metadata: { type: Sequelize.JSONB, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('stripe_webhook_events', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('uuid_generate_v4()'), primaryKey: true },
      event_id: { type: Sequelize.STRING, allowNull: false, unique: true },
      event_type: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.ENUM('PROCESSING', 'PROCESSED', 'FAILED'), defaultValue: 'PROCESSING' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false }
    });

    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('uuid_generate_v4()'), primaryKey: true },
      actor_user_id: { type: Sequelize.UUID, allowNull: false },
      action: { type: Sequelize.STRING, allowNull: false },
      entity_type: { type: Sequelize.STRING, allowNull: false },
      entity_id: { type: Sequelize.STRING, allowNull: false },
      old_value: { type: Sequelize.JSONB, allowNull: true },
      new_value: { type: Sequelize.JSONB, allowNull: true },
      ip_address: { type: Sequelize.STRING, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
    await queryInterface.dropTable('stripe_webhook_events');
    await queryInterface.dropTable('token_ledger');
    await queryInterface.dropTable('wallets');
    await queryInterface.dropTable('subscriptions');
    await queryInterface.dropTable('plans');
    await queryInterface.dropTable('otps');
    await queryInterface.dropTable('users');
  }
};