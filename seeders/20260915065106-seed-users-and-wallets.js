'use strict';
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  async up(queryInterface) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
    const userEmail = process.env.DEFAULT_USER_EMAIL || 'user@example.com';
    const userPassword = process.env.DEFAULT_USER_PASSWORD || 'User@12345';

    const adminHashedPassword = await bcrypt.hash(adminPassword, 12);
    const userHashedPassword = await bcrypt.hash(userPassword, 12);

    const adminId = uuidv4();
    const userId = uuidv4();
    const now = new Date();

    // 1. Insert Admin and User records
    await queryInterface.bulkInsert('users', [
      {
        id: adminId,
        name: 'System Admin',
        email: adminEmail,
        password_hash: adminHashedPassword,
        role: 'ADMIN',
        email_verified: true,
        status: 'ACTIVE',
        stripe_customer_id: null,
        created_at: now,
        updated_at: now
      },
      {
        id: userId,
        name: 'Standard User',
        email: userEmail,
        password_hash: userHashedPassword,
        role: 'USER',
        email_verified: true,
        status: 'ACTIVE',
        stripe_customer_id: null,
        created_at: now,
        updated_at: now
      }
    ]);

    // 2. Initialize corresponding Wallets for each account
    await queryInterface.bulkInsert('wallets', [
      {
        id: uuidv4(),
        user_id: adminId,
        current_token_balance: 10000,
        created_at: now,
        updated_at: now
      },
      {
        id: uuidv4(),
        user_id: userId,
        current_token_balance: 100,
        created_at: now,
        updated_at: now
      }
    ]);
  },

  async down(queryInterface) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const userEmail = process.env.DEFAULT_USER_EMAIL || 'user@example.com';

    await queryInterface.bulkDelete(
      'users',
      {
        email: [adminEmail, userEmail]
      },
      {}
    );
  }
};