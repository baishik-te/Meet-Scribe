'use strict';

module.exports = {
  async up(queryInterface) {
    // Before is_chat_attachment existed, supplementary uploads were already
    // identifiable because their session_id pointed to another document.
    // Hide those legacy chat files from the global document library too.
    await queryInterface.sequelize.query(`
      UPDATE documents
         SET is_chat_attachment = TRUE
       WHERE session_id IS NOT NULL
         AND session_id <> id
         AND is_chat_attachment = FALSE;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE documents
         SET is_chat_attachment = FALSE
       WHERE session_id IS NOT NULL
         AND session_id <> id;
    `);
  },
};
