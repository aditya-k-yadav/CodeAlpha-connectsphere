const express = require('express');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

function publicUser(u) {
  return u ? { id: u.id, name: u.name, username: u.username, avatar: u.avatar } : null;
}

// List all conversations for the logged-in user, most recent first,
// each with the other participant's info, the last message, and unread count.
router.get('/conversations', authRequired, (req, res) => {
  const db = readDb();
  const myId = req.user.id;

  const myMessages = db.messages.filter(m => m.senderId === myId || m.receiverId === myId);
  const otherIds = new Set(myMessages.map(m => (m.senderId === myId ? m.receiverId : m.senderId)));

  const conversations = [...otherIds].map(otherId => {
    const other = db.users.find(u => u.id === otherId);
    const thread = myMessages
      .filter(m => m.senderId === otherId || m.receiverId === otherId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const lastMessage = thread[0];
    const unreadCount = thread.filter(m => m.receiverId === myId && !m.read).length;

    return {
      user: publicUser(other),
      lastMessage: lastMessage ? { content: lastMessage.content, createdAt: lastMessage.createdAt, fromMe: lastMessage.senderId === myId } : null,
      unreadCount
    };
  }).filter(c => c.user);

  conversations.sort((a, b) => new Date(b.lastMessage?.createdAt || 0) - new Date(a.lastMessage?.createdAt || 0));
  res.json(conversations);
});

// Full message thread with a specific user (marks their messages to you as read).
router.get('/:username', authRequired, (req, res) => {
  const db = readDb();
  const other = db.users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
  if (!other) return res.status(404).json({ error: 'User not found' });
  if (other.id === req.user.id) return res.status(400).json({ error: "You can't message yourself" });

  const myId = req.user.id;
  const thread = db.messages
    .filter(m => (m.senderId === myId && m.receiverId === other.id) || (m.senderId === other.id && m.receiverId === myId))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  let changed = false;
  thread.forEach(m => {
    if (m.receiverId === myId && !m.read) { m.read = true; changed = true; }
  });
  if (changed) writeDb(db);

  res.json({
    user: publicUser(other),
    messages: thread.map(m => ({ id: m.id, content: m.content, fromMe: m.senderId === myId, createdAt: m.createdAt }))
  });
});

// Send a message to a user by username.
router.post('/:username', authRequired, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Message cannot be empty' });
  if (content.length > 1000) return res.status(400).json({ error: 'Message is too long (max 1000 characters)' });

  const db = readDb();
  const other = db.users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
  if (!other) return res.status(404).json({ error: 'User not found' });
  if (other.id === req.user.id) return res.status(400).json({ error: "You can't message yourself" });

  const message = {
    id: nanoid(10),
    senderId: req.user.id,
    receiverId: other.id,
    content: content.trim(),
    read: false,
    createdAt: new Date().toISOString()
  };
  db.messages.push(message);
  writeDb(db);

  res.status(201).json({ id: message.id, content: message.content, fromMe: true, createdAt: message.createdAt });
});

module.exports = router;
