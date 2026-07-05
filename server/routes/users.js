const express = require('express');
const { readDb, writeDb } = require('../db');
const { authRequired, optionalAuth } = require('../middleware/auth');

const router = express.Router();

function profileFor(user, db, viewerId) {
  const followers = db.follows.filter(f => f.followingId === user.id).length;
  const following = db.follows.filter(f => f.followerId === user.id).length;
  const postCount = db.posts.filter(p => p.userId === user.id).length;
  const isFollowing = viewerId ? db.follows.some(f => f.followerId === viewerId && f.followingId === user.id) : false;

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    bio: user.bio,
    avatar: user.avatar,
    followers,
    following,
    postCount,
    isFollowing,
    isSelf: viewerId === user.id
  };
}

router.get('/search', (req, res) => {
  const { q } = req.query;
  const db = readDb();
  if (!q) return res.json([]);
  const query = q.toLowerCase();
  const matches = db.users
    .filter(u => u.name.toLowerCase().includes(query) || u.username.toLowerCase().includes(query))
    .slice(0, 10)
    .map(u => ({ id: u.id, name: u.name, username: u.username, avatar: u.avatar }));
  res.json(matches);
});

router.get('/:username', optionalAuth, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(profileFor(user, db, req.user?.id));
});

router.get('/:username/posts', optionalAuth, (req, res) => {
  const db = readDb();
  const user = db.users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });

  const posts = db.posts
    .filter(p => p.userId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(p => ({
      id: p.id,
      content: p.content,
      createdAt: p.createdAt,
      likeCount: p.likes.length,
      likedByViewer: req.user ? p.likes.includes(req.user.id) : false,
      commentCount: db.comments.filter(c => c.postId === p.id).length,
      author: { id: user.id, name: user.name, username: user.username, avatar: user.avatar }
    }));
  res.json(posts);
});

router.post('/:username/follow', authRequired, (req, res) => {
  const db = readDb();
  const target = db.users.find(u => u.username.toLowerCase() === req.params.username.toLowerCase());
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.id) return res.status(400).json({ error: "You can't follow yourself" });

  const existing = db.follows.findIndex(f => f.followerId === req.user.id && f.followingId === target.id);
  if (existing === -1) db.follows.push({ followerId: req.user.id, followingId: target.id });
  else db.follows.splice(existing, 1);

  writeDb(db);
  res.json(profileFor(target, db, req.user.id));
});

router.put('/me/bio', authRequired, (req, res) => {
  const { bio } = req.body;
  const db = readDb();
  const user = db.users.find(u => u.id === req.user.id);
  user.bio = (bio || '').slice(0, 160);
  writeDb(db);
  res.json(profileFor(user, db, req.user.id));
});

module.exports = router;
