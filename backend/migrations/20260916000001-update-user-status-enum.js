'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      ALTER TYPE "enum_users_status" ADD VALUE IF NOT EXISTS 'INACTIVE' BEFORE 'ACTIVE';
    `);

    await queryInterface.sequelize.query(`
      UPDATE users SET status = 'INACTIVE' WHERE status = 'PENDING';
    `);


    await queryInterface.changeColumn('users', 'status', {
      type: Sequelize.ENUM('PENDING', 'INACTIVE', 'ACTIVE', 'SUSPENDED', 'DELETED'),
      defaultValue: 'INACTIVE',
      allowNull: false
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.sequelize.query(`
      UPDATE users SET status = 'PENDING' WHERE status = 'INACTIVE';
    `);

    await queryInterface.changeColumn('users', 'status', {
      type: Sequelize.ENUM('PENDING', 'INACTIVE', 'ACTIVE', 'SUSPENDED', 'DELETED'),
      defaultValue: 'PENDING',
      allowNull: false
    });
  }
};