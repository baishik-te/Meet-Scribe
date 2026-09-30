'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_subscriptions_status" ADD VALUE IF NOT EXISTS 'INCOMPLETE_EXPIRED';
      ALTER TYPE "enum_subscriptions_status" ADD VALUE IF NOT EXISTS 'UNPAID';
    `);
  },

  down: async (queryInterface, Sequelize) => {
    console.log('Downgrade not supported for enum additions');
  }
};
