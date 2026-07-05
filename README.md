# ConnectSphere 🌐

A full-stack mini social media platform — create posts, like and comment, follow other users, and build a profile. Built with a Node.js/Express REST API and a vanilla JavaScript single-page frontend.

## Features

- 🔐 User registration & login with JWT authentication and hashed passwords
- 📝 Create, view, and delete posts (500 character limit)
- ❤️ Like / unlike posts
- 💬 Comment on posts
- 👥 Follow / unfollow other users
- 🏠 Personalized home feed (posts from people you follow) + a global Explore feed
- 🔎 Search for users by name or username
- 💬 Direct messaging — private 1-to-1 chat with any user, inbox with unread counts, auto-refreshing conversation view
- 🙍 Profile pages with bio, follower/following counts, and post history
- 🎨 Clean, responsive dark-themed UI — no frontend framework or build step required

## Tech Stack

| Layer    | Technology                                  |
|----------|----------------------------------------------|
| Frontend | HTML, CSS, vanilla JavaScript (hash router)   |
| Backend  | Node.js, Express 5                            |
| Auth     | JWT (jsonwebtoken) + bcryptjs password hashing|
| Database | Lightweight JSON file store (`server/data/db.json`, auto-created) |

No external database server (like MongoDB or PostgreSQL) is required — everything runs locally out of the box.

## Project Structure

```
connectsphere/
├── public/            # Frontend (served statically)
│   ├── index.html
│   ├── style.css
│   └── app.js
├── server/
│   ├── index.js        # Express app entrypoint
│   ├── db.js            # JSON file database helper
│   ├── middleware/
│   │   └── auth.js       # JWT verification middleware
│   └── routes/
│       ├── auth.js        # /api/auth/register, /api/auth/login
│       ├── posts.js       # /api/posts (feed, likes, comments)
│       └── users.js       # /api/users (profiles, follow, search)
├── package.json
└── README.md
```

## Getting Started (VS Code / Local Machine)

### 1. Prerequisites
- [Node.js](https://nodejs.org) v18 or later installed
- VS Code (or any editor)

### 2. Open the project
```bash
cd connectsphere
code .
```

### 3. Install dependencies
Open a terminal in VS Code (`` Ctrl+` `` / `` Cmd+` ``) and run:
```bash
npm install
```

### 4. Start the server
```bash
npm start
```
You should see:
```
ConnectSphere server running at http://localhost:4000
```

### 5. Open it in your browser
Go to **http://localhost:4000** — the app is now running fully locally.

> Tip: use `npm run dev` instead to auto-restart the server whenever you edit a file (uses Node's built-in `--watch`).

### Trying the follow/feed features
Since the home feed only shows posts from people you follow (plus your own), open two browser windows (or one normal + one incognito), register two different accounts, follow one from the other, and post from both to see the feed personalize itself.

## API Reference

| Method | Endpoint                     | Auth | Description                          |
|--------|--------------------------------|------|----------------------------------------|
| POST   | `/api/auth/register`           | No   | Create a new account                   |
| POST   | `/api/auth/login`              | No   | Log in, returns a JWT                  |
| GET    | `/api/posts`                   | Optional | Global explore feed                |
| GET    | `/api/posts/feed`               | Optional | Personalized feed (following + own)|
| POST   | `/api/posts`                    | Yes  | Create a post                          |
| DELETE | `/api/posts/:id`                | Yes  | Delete your own post                   |
| POST   | `/api/posts/:id/like`           | Yes  | Like / unlike a post                   |
| POST   | `/api/posts/:id/comments`        | Yes  | Comment on a post                      |
| GET    | `/api/users/search?q=`          | No   | Search users by name/username          |
| GET    | `/api/users/:username`          | Optional | View a profile                     |
| GET    | `/api/users/:username/posts`    | Optional | A user's posts                     |
| POST   | `/api/users/:username/follow`   | Yes  | Follow / unfollow a user               |
| PUT    | `/api/users/me/bio`             | Yes  | Update your own bio                    |
| GET    | `/api/messages/conversations`   | Yes  | List your conversations with unread counts |
| GET    | `/api/messages/:username`       | Yes  | Full message thread with a user (marks as read) |
| POST   | `/api/messages/:username`       | Yes  | Send a direct message to a user        |

Authenticated requests need an `Authorization: Bearer <token>` header.

## Notes & Next Steps

This project uses a JSON-file database for simplicity and portability. To scale it up, swap `server/db.js` for a real database (PostgreSQL, MongoDB, SQLite) — the route files are already structured so that change stays isolated to `db.js`.

Direct messages currently refresh via short polling (every 3 seconds while a chat is open) rather than WebSockets — simple and reliable, though a true WebSocket/Socket.io upgrade would make it instant and reduce network requests.

Ideas to extend it further: image uploads for posts and avatars, real-time notifications via WebSockets, hashtags/mentions, infinite-scroll pagination, typing indicators, message read receipts in the chat UI.
