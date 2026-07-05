const { gmail } = require('./gmail-client');

// Trashes each processed newsletter email so the inbox stays clean.
async function archiveMessages(messageIds) {
  for (const id of messageIds) {
    await gmail.users.messages.trash({ userId: 'me', id });
  }
}

module.exports = { archiveMessages };
