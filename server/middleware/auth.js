const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'connectsphere-dev-secret-change-me';

function authRequired(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
}

// Attaches req.user if a valid token is present, but doesn't block the request otherwise.
function optionalAuth(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return next();
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err) req.user = decoded;
    next();
  });
}

module.exports = { authRequired, optionalAuth, JWT_SECRET };
