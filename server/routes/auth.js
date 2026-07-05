const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🐨', '🐸', '🦄', '🐙', '🦉', '🐢', '🦋', '🐳'];

router.post('/register', async (req, res) => {
  const { name, username, email, password } = req.body;
  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'Name, username, email and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, underscore only)' });
  }

  const db = readDb();
  if (db.users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }
  if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return res.status(409).json({ error: 'Username is already taken' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = {
    id: nanoid(10),
    name,
    username,
    email,
    password: hashed,
    bio: '',
    avatar: AVATARS[Math.floor(Math.random() * AVATARS.length)],
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  writeDb(db);

  const token = jwt.sign({ id: user.id, name: user.name, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  const db = readDb();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid email or password' });

  const token = jwt.sign({ id: user.id, name: user.name, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: publicUser(user) });
});

function publicUser(u) {
  return { id: u.id, name: u.name, username: u.username, bio: u.bio, avatar: u.avatar };
}

module.exports = router;
