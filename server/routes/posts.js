const express = require('express');
const { nanoid } = require('nanoid');
const { readDb, writeDb } = require('../db');
const { authRequired, optionalAuth } = require('../middleware/auth');

const router = express.Router();

function enrichPost(post, db, viewerId) {
  const author = db.users.find(u => u.id === post.userId);
  const comments = db.comments
    .filter(c => c.postId === post.id)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map(c => {
      const commenter = db.users.find(u => u.id === c.userId);
      return {
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        author: commenter ? { id: commenter.id, name: commenter.name, username: commenter.username, avatar: commenter.avatar } : null
      };
    });

  return {
    id: post.id,
    content: post.content,
    createdAt: post.createdAt,
    likeCount: post.likes.length,
    likedByViewer: viewerId ? post.likes.includes(viewerId) : false,
    commentCount: comments.length,
    comments,
    author: author ? { id: author.id, name: author.name, username: author.username, avatar: author.avatar } : null
  };
}

// Feed: posts from people you follow + your own. Falls back to global feed if not following anyone.
router.get('/feed', optionalAuth, (req, res) => {
  const db = readDb();
  let posts = db.posts;

  if (req.user) {
    const followingIds = db.follows.filter(f => f.followerId === req.user.id).map(f => f.followingId);
    const relevantIds = new Set([...followingIds, req.user.id]);
    const personalized = posts.filter(p => relevantIds.has(p.userId));
    if (personalized.length > 0) posts = personalized;
  }

  posts = posts.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(posts.map(p => enrichPost(p, db, req.user?.id)));
});

// Global explore feed (everyone's posts)
router.get('/', optionalAuth, (req, res) => {
  const db = readDb();
  const posts = db.posts.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(posts.map(p => enrichPost(p, db, req.user?.id)));
});

router.post('/', authRequired, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Post content cannot be empty' });
  if (content.length > 500) return res.status(400).json({ error: 'Post is too long (max 500 characters)' });

  const db = readDb();
  const post = { id: nanoid(10), userId: req.user.id, content: content.trim(), likes: [], createdAt: new Date().toISOString() };
  db.posts.push(post);
  writeDb(db);
  res.status(201).json(enrichPost(post, db, req.user.id));
});

router.delete('/:id', authRequired, (req, res) => {
  const db = readDb();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.userId !== req.user.id) return res.status(403).json({ error: 'You can only delete your own posts' });

  db.posts = db.posts.filter(p => p.id !== req.params.id);
  db.comments = db.comments.filter(c => c.postId !== req.params.id);
  writeDb(db);
  res.json({ success: true });
});

router.post('/:id/like', authRequired, (req, res) => {
  const db = readDb();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const idx = post.likes.indexOf(req.user.id);
  if (idx === -1) post.likes.push(req.user.id);
  else post.likes.splice(idx, 1);

  writeDb(db);
  res.json(enrichPost(post, db, req.user.id));
});

router.post('/:id/comments', authRequired, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });

  const db = readDb();
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const comment = { id: nanoid(10), postId: post.id, userId: req.user.id, content: content.trim(), createdAt: new Date().toISOString() };
  db.comments.push(comment);
  writeDb(db);
  res.status(201).json(enrichPost(post, db, req.user.id));
});

module.exports = router;
