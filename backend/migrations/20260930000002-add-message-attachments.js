'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('messages', 'file_url', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('messages', 'file_name', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('messages', 'file_type', {
      type: Sequelize.STRING,
      allowNull: true
    });
    await queryInterface.addColumn('messages', 'file_size', {
      type: Sequelize.INTEGER,
      allowNull: true
    });
    await queryInterface.changeColumn('messages', 'body', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('messages', 'file_url');
    await queryInterface.removeColumn('messages', 'file_name');
    await queryInterface.removeColumn('messages', 'file_type');
    await queryInterface.removeColumn('messages', 'file_size');
    await queryInterface.changeColumn('messages', 'body', {
      type: Sequelize.TEXT,
      allowNull: false
    });
  }
};
