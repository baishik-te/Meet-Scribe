'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, we need to alter the enum type
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_subscriptions_status" ADD VALUE IF NOT EXISTS 'INCOMPLETE_EXPIRED';
      ALTER TYPE "enum_subscriptions_status" ADD VALUE IF NOT EXISTS 'UNPAID';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    // Note: PostgreSQL doesn't support removing enum values easily
    // This would require recreating the enum and column
    console.log('Downgrade not supported for enum additions');
  }
};
