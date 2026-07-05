const API = '/api';

const state = {
  get token() { return localStorage.getItem('cs_token'); },
  set token(v) { v ? localStorage.setItem('cs_token', v) : localStorage.removeItem('cs_token'); },
  get user() { const u = localStorage.getItem('cs_user'); return u ? JSON.parse(u) : null; },
  set user(v) { v ? localStorage.setItem('cs_user', JSON.stringify(v)) : localStorage.removeItem('cs_user'); }
};

function isLoggedIn() { return !!state.token; }

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (isLoggedIn()) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

const app = document.getElementById('app');
function navigate(hash) { window.location.hash = hash; }

async function router() {
  stopChatPolling();
  const hash = window.location.hash || '#/';
  const [route, param] = hash.slice(2).split('/');
  renderNav();

  if (hash === '#/' || hash === '') return renderFeed();
  if (route === 'explore') return renderExplore();
  if (route === 'search') return renderSearch();
  if (route === 'profile') return renderProfile(param);
  if (route === 'messages') return isLoggedIn() ? (param ? renderChat(param) : renderInbox()) : renderLogin();
  if (route === 'login') return renderLogin();
  if (route === 'register') return renderRegister();
  return renderFeed();
}
window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
setInterval(refreshUnreadBadge, 15000);

function renderNav() {
  const nav = document.getElementById('nav-right');
  if (isLoggedIn()) {
    nav.innerHTML = `
      <a href="#/">Home</a>
      <a href="#/explore">Explore</a>
      <a href="#/search">Search</a>
      <a href="#/messages">Messages${window.__unreadTotal ? `<span class="msg-badge">${window.__unreadTotal}</span>` : ''}</a>
      <a href="#/profile/${state.user.username}">Profile</a>
      <button onclick="logout()">Logout</button>
    `;
    refreshUnreadBadge();
  } else {
    nav.innerHTML = `
      <a href="#/explore">Explore</a>
      <a href="#/login">Login</a>
      <a href="#/register">Sign Up</a>
    `;
  }
}

function logout() {
  state.token = null;
  state.user = null;
  navigate('#/');
}

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function postCard(p) {
  return `
    <div class="post" data-post-id="${p.id}">
      <div class="post-header">
        <div class="avatar">${p.author?.avatar || '👤'}</div>
        <div class="names">
          <span class="display-name">${p.author?.name || 'Unknown'}</span>
          <span class="username" onclick="navigate('#/profile/${p.author?.username}')" style="cursor:pointer;">@${p.author?.username}</span>
        </div>
        <span class="time">${timeAgo(p.createdAt)}</span>
      </div>
      <div class="post-content">${escapeHtml(p.content)}</div>
      <div class="post-actions">
        <button class="action-btn ${p.likedByViewer ? 'liked' : ''}" onclick="toggleLike('${p.id}')">
          ${p.likedByViewer ? '❤️' : '🤍'} ${p.likeCount}
        </button>
        <button class="action-btn" onclick="toggleComments('${p.id}')">💬 ${p.commentCount}</button>
        ${isLoggedIn() && p.author?.id === state.user.id ? `<button class="action-btn" onclick="deletePost('${p.id}')">🗑️</button>` : ''}
      </div>
      <div class="comments" id="comments-${p.id}" style="display:none;">
        ${(p.comments || []).map(commentHtml).join('')}
        ${isLoggedIn() ? `
          <div class="comment-form">
            <input id="comment-input-${p.id}" placeholder="Write a comment..." onkeypress="if(event.key==='Enter') submitComment('${p.id}')" />
            <button class="btn small" onclick="submitComment('${p.id}')">Post</button>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function commentHtml(c) {
  return `
    <div class="comment">
      <div class="avatar">${c.author?.avatar || '👤'}</div>
      <div class="comment-body">
        <span class="cname">${c.author?.name || 'Unknown'}</span> <span style="color:var(--text-dim); font-size:12px;">@${c.author?.username}</span>
        <div>${escapeHtml(c.content)}</div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function toggleComments(postId) {
  const el = document.getElementById(`comments-${postId}`);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function toggleLike(postId) {
  if (!isLoggedIn()) return navigate('#/login');
  try {
    await api(`/posts/${postId}/like`, { method: 'POST' });
    router();
  } catch (e) { alert(e.message); }
}

async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  const content = input.value.trim();
  if (!content) return;
  try {
    await api(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
    router();
    setTimeout(() => {
      const c = document.getElementById(`comments-${postId}`);
      if (c) c.style.display = 'block';
    }, 50);
  } catch (e) { alert(e.message); }
}

async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  try {
    await api(`/posts/${postId}`, { method: 'DELETE' });
    router();
  } catch (e) { alert(e.message); }
}

// ---------- Feed ----------
async function renderFeed() {
  if (!isLoggedIn()) return renderExplore();

  app.innerHTML = `
    <div class="container">
      <div class="composer">
        <textarea id="post-content" maxlength="500" placeholder="What's on your mind?"></textarea>
        <div class="composer-footer">
          <span class="char-count" id="char-count">0 / 500</span>
          <button class="btn" onclick="submitPost()">Post</button>
        </div>
      </div>
      <div id="feed-list">Loading...</div>
    </div>
  `;
  document.getElementById('post-content').addEventListener('input', (e) => {
    document.getElementById('char-count').textContent = `${e.target.value.length} / 500`;
  });

  const posts = await api('/posts/feed');
  const list = document.getElementById('feed-list');
  list.innerHTML = posts.length
    ? posts.map(postCard).join('')
    : `<div class="empty-state"><div class="icon">✨</div><p>No posts yet. Follow people or check Explore!</p></div>`;
}

async function submitPost() {
  const textarea = document.getElementById('post-content');
  const content = textarea.value.trim();
  if (!content) return;
  try {
    await api('/posts', { method: 'POST', body: JSON.stringify({ content }) });
    textarea.value = '';
    renderFeed();
  } catch (e) { alert(e.message); }
}

// ---------- Explore ----------
async function renderExplore() {
  app.innerHTML = `<div class="container"><h1>Explore</h1><div id="explore-list">Loading...</div></div>`;
  const posts = await api('/posts');
  const list = document.getElementById('explore-list');
  list.innerHTML = posts.length
    ? posts.map(postCard).join('')
    : `<div class="empty-state"><div class="icon">🌍</div><p>No posts yet. Be the first!</p></div>`;
}

// ---------- Search ----------
async function renderSearch() {
  app.innerHTML = `
    <div class="container">
      <h1>Find People</h1>
      <div class="search-box"><input id="search-input" placeholder="Search by name or username..." /></div>
      <div id="search-results"></div>
    </div>
  `;
  document.getElementById('search-input').addEventListener('input', debounce(async (e) => {
    const q = e.target.value.trim();
    const results = document.getElementById('search-results');
    if (!q) { results.innerHTML = ''; return; }
    const users = await api(`/users/search?q=${encodeURIComponent(q)}`);
    results.innerHTML = users.length
      ? users.map(u => `
        <div class="user-result" onclick="navigate('#/profile/${u.username}')">
          <div class="avatar">${u.avatar}</div>
          <div><div style="font-weight:600;">${u.name}</div><div style="color:var(--text-dim); font-size:13px;">@${u.username}</div></div>
        </div>
      `).join('')
      : `<div class="empty-state"><p>No users found.</p></div>`;
  }, 250));
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// ---------- Profile ----------
async function renderProfile(username) {
  app.innerHTML = `<div class="container"><p>Loading...</p></div>`;
  let profile, posts;
  try {
    profile = await api(`/users/${username}`);
    posts = await api(`/users/${username}/posts`);
  } catch (e) {
    app.innerHTML = `<div class="container"><div class="alert error">${e.message}</div></div>`;
    return;
  }

  app.innerHTML = `
    <div class="container">
      <div class="profile-header">
        <div class="avatar">${profile.avatar}</div>
        <div style="flex:1;">
          <h2 style="margin:0;">${profile.name}</h2>
          <div style="color:var(--text-dim);">@${profile.username}</div>
          ${profile.bio ? `<div class="bio-text">${escapeHtml(profile.bio)}</div>` : ''}
          <div class="profile-stats">
            <span><strong>${profile.postCount}</strong> posts</span>
            <span><strong>${profile.followers}</strong> followers</span>
            <span><strong>${profile.following}</strong> following</span>
          </div>
        </div>
        ${profile.isSelf
          ? `<button class="btn secondary" onclick="editBio('${profile.username}', ${JSON.stringify(profile.bio).replace(/"/g, '&quot;')})">Edit Bio</button>`
          : isLoggedIn()
            ? `<div style="display:flex; gap:8px;">
                 <button class="btn ${profile.isFollowing ? 'secondary' : ''}" onclick="toggleFollow('${profile.username}')">${profile.isFollowing ? 'Following' : 'Follow'}</button>
                 <button class="btn secondary" onclick="navigate('#/messages/${profile.username}')">Message</button>
               </div>`
            : ''
        }
      </div>
      <div id="profile-posts">${posts.length ? posts.map(postCard).join('') : `<div class="empty-state"><div class="icon">📝</div><p>No posts yet.</p></div>`}</div>
    </div>
  `;
}

async function toggleFollow(username) {
  if (!isLoggedIn()) return navigate('#/login');
  try {
    await api(`/users/${username}/follow`, { method: 'POST' });
    renderProfile(username);
  } catch (e) { alert(e.message); }
}

async function editBio(username, currentBio) {
  const bio = prompt('Update your bio:', currentBio || '');
  if (bio === null) return;
  try {
    await api('/users/me/bio', { method: 'PUT', body: JSON.stringify({ bio }) });
    renderProfile(username);
  } catch (e) { alert(e.message); }
}

// ---------- Auth ----------
function renderLogin() {
  app.innerHTML = `
    <div class="form-box">
      <h2>Welcome back</h2>
      <div id="auth-alert"></div>
      <input id="email" type="email" placeholder="Email" />
      <input id="password" type="password" placeholder="Password" />
      <button class="btn full" style="margin-top:12px;" onclick="handleLogin()">Log In</button>
      <div class="switch-link">No account? <a onclick="navigate('#/register')">Sign up</a></div>
    </div>
  `;
}

function renderRegister() {
  app.innerHTML = `
    <div class="form-box">
      <h2>Join ConnectSphere</h2>
      <div id="auth-alert"></div>
      <input id="name" placeholder="Full name" />
      <input id="username" placeholder="Username" />
      <input id="email" type="email" placeholder="Email" />
      <input id="password" type="password" placeholder="Password (min 6 chars)" />
      <button class="btn full" style="margin-top:12px;" onclick="handleRegister()">Sign Up</button>
      <div class="switch-link">Already have an account? <a onclick="navigate('#/login')">Log in</a></div>
    </div>
  `;
}

async function handleLogin() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    state.token = data.token;
    state.user = data.user;
    navigate('#/');
  } catch (e) {
    document.getElementById('auth-alert').innerHTML = `<div class="alert error">${e.message}</div>`;
  }
}

// ---------- Messages ----------
let chatPollTimer = null;

function stopChatPolling() {
  if (chatPollTimer) { clearInterval(chatPollTimer); chatPollTimer = null; }
}

async function refreshUnreadBadge() {
  if (!isLoggedIn()) return;
  try {
    const conversations = await api('/messages/conversations');
    const total = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
    if (total !== window.__unreadTotal) {
      window.__unreadTotal = total;
      renderNavBadgeOnly();
    }
  } catch (e) { /* ignore polling errors */ }
}

function renderNavBadgeOnly() {
  const link = document.querySelector('#nav-right a[href="#/messages"]');
  if (!link) return;
  link.innerHTML = `Messages${window.__unreadTotal ? `<span class="msg-badge">${window.__unreadTotal}</span>` : ''}`;
}

async function renderInbox() {
  stopChatPolling();
  app.innerHTML = `<div class="container"><h1>Messages</h1><div id="inbox-list">Loading...</div></div>`;
  const conversations = await api('/messages/conversations');
  const list = document.getElementById('inbox-list');
  list.innerHTML = conversations.length
    ? conversations.map(c => `
      <div class="user-result" onclick="navigate('#/messages/${c.user.username}')">
        <div class="avatar">${c.user.avatar}</div>
        <div style="flex:1;">
          <div style="font-weight:600;">${c.user.name} <span style="color:var(--text-dim); font-weight:400; font-size:13px;">@${c.user.username}</span></div>
          <div style="color:var(--text-dim); font-size:13px;">${c.lastMessage.fromMe ? 'You: ' : ''}${escapeHtml(c.lastMessage.content)}</div>
        </div>
        ${c.unreadCount ? `<span class="msg-badge">${c.unreadCount}</span>` : ''}
      </div>
    `).join('')
    : `<div class="empty-state"><div class="icon">💬</div><p>No conversations yet. Visit someone's profile and hit "Message" to start one.</p></div>`;
  refreshUnreadBadge();
}

async function renderChat(username) {
  stopChatPolling();
  app.innerHTML = `
    <div class="container">
      <button class="btn secondary small" onclick="navigate('#/messages')" style="margin-bottom:16px;">&larr; All messages</button>
      <div id="chat-header"></div>
      <div id="chat-thread" class="chat-thread"></div>
      <div class="comment-form" style="margin-top:16px;">
        <input id="chat-input" placeholder="Type a message..." onkeypress="if(event.key==='Enter') sendChatMessage('${username}')" />
        <button class="btn" onclick="sendChatMessage('${username}')">Send</button>
      </div>
    </div>
  `;

  async function loadThread(scrollToBottom) {
    let data;
    try {
      data = await api(`/messages/${username}`);
    } catch (e) {
      app.innerHTML = `<div class="container"><div class="alert error">${e.message}</div></div>`;
      stopChatPolling();
      return;
    }
    document.getElementById('chat-header').innerHTML = `
      <div class="post-header" style="margin-bottom:16px;">
        <div class="avatar">${data.user.avatar}</div>
        <div class="names">
          <span class="display-name">${data.user.name}</span>
          <span class="username">@${data.user.username}</span>
        </div>
      </div>
    `;
    const thread = document.getElementById('chat-thread');
    thread.innerHTML = data.messages.length
      ? data.messages.map(m => `
          <div class="chat-bubble-row ${m.fromMe ? 'from-me' : ''}">
            <div class="chat-bubble">${escapeHtml(m.content)}</div>
            <div class="chat-time">${timeAgo(m.createdAt)}</div>
          </div>
        `).join('')
      : `<div class="empty-state"><div class="icon">👋</div><p>Say hello to start the conversation.</p></div>`;
    if (scrollToBottom) thread.scrollTop = thread.scrollHeight;
    refreshUnreadBadge();
  }

  await loadThread(true);
  chatPollTimer = setInterval(() => loadThread(false), 3000);
}

async function sendChatMessage(username) {
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    await api(`/messages/${username}`, { method: 'POST', body: JSON.stringify({ content }) });
    renderChat(username);
  } catch (e) { alert(e.message); }
}

async function handleRegister() {
  const name = document.getElementById('name').value.trim();
  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  try {
    const data = await api('/auth/register', { method: 'POST', body: JSON.stringify({ name, username, email, password }) });
    state.token = data.token;
    state.user = data.user;
    navigate('#/');
  } catch (e) {
    document.getElementById('auth-alert').innerHTML = `<div class="alert error">${e.message}</div>`;
  }
}
