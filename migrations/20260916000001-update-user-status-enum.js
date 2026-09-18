'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, add INACTIVE as a valid enum value
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_users_status" ADD VALUE IF NOT EXISTS 'INACTIVE' BEFORE 'ACTIVE';
    `);

    // Update any existing 'PENDING' values to 'INACTIVE'
    await queryInterface.sequelize.query(`
      UPDATE users SET status = 'INACTIVE' WHERE status = 'PENDING';
    `);

    // Update the default value for new users
    await queryInterface.changeColumn('users', 'status', {
      type: Sequelize.ENUM('PENDING', 'INACTIVE', 'ACTIVE', 'SUSPENDED', 'DELETED'),
      defaultValue: 'INACTIVE',
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Reverse the migration - convert back to PENDING
    await queryInterface.sequelize.query(`
      UPDATE users SET status = 'PENDING' WHERE status = 'INACTIVE';
    `);

    // Restore original default
    await queryInterface.changeColumn('users', 'status', {
      type: Sequelize.ENUM('PENDING', 'INACTIVE', 'ACTIVE', 'SUSPENDED', 'DELETED'),
      defaultValue: 'PENDING',
      allowNull: false
    });
  }
};