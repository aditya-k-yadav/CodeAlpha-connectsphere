// Tiny file-based JSON database — zero setup, human-readable, perfect for
// learning projects and small apps. Swap this module out for a real DB later.
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data', 'db.json');

function defaultData() {
  return {
    users: [],       // { id, name, username, email, password, bio, avatar, createdAt }
    posts: [],        // { id, userId, content, likes: [userId], createdAt }
    comments: [],      // { id, postId, userId, content, createdAt }
    follows: [],         // { followerId, followingId }
    messages: []           // { id, senderId, receiverId, content, read, createdAt }
  };
}

function ensureDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultData(), null, 2));
  }
}

// Adds any new collections (like `messages`) to databases created before this feature existed,
// so upgrading the app never breaks on an older db.json.
function migrate(data) {
  let changed = false;
  const defaults = defaultData();
  for (const key of Object.keys(defaults)) {
    if (!Array.isArray(data[key])) { data[key] = []; changed = true; }
  }
  if (changed) writeDb(data);
  return data;
}

function readDb() {
  ensureDb();
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  return migrate(data);
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb };
