// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
//
// Optional GitHub sign-in (C2). The OAuth code exchange always runs on the
// host-side helper (DEPLOY.md "Accounts"), so this process never sees the
// GitHub client secret and the container needs no egress.
//
// Two state modes, selected with PLAYGROUND_STATE:
//
//   local (default) -- sessions are stateless HMAC cookies signed with
//     SESSION_SECRET, exactly as before.
//   helper -- P2: the helper mints an opaque session token on a successful
//     exchange and owns the session store; the container keeps no signing
//     secret and verifies cookies with a short-cached helper lookup
//     (docs/P2_STATE_HELPER_DESIGN.md). The OAuth state is signed with a
//     key generated at startup, so a restart only invalidates a pending
//     sign-in.
'use strict';

const crypto = require('crypto');

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || '';
const HELPER_URL = (process.env.AUTH_HELPER_URL || '').replace(/\/+$/, '');
const HELPER_KEY = process.env.AUTH_HELPER_KEY || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const GITHUB_OAUTH_BASE = (process.env.GITHUB_OAUTH_BASE || 'https://github.com').replace(/\/+$/, '');

const STATE_MODE = process.env.PLAYGROUND_STATE === 'helper' ? 'helper' : 'local';
const STATE_KEY = STATE_MODE === 'helper' ? crypto.randomBytes(32) : null;

const SESSION_COOKIE = 'xiom_session';
const SESSION_TTL_MS = Math.max(1, Number(process.env.SESSION_TTL_HOURS) || 720) * 3600 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;
const HELPER_TIMEOUT_MS = Math.max(1000, Number(process.env.AUTH_HELPER_TIMEOUT_MS) || 8000);
// Helper mode: how long a verified (or rejected) session lookup is reused.
// The positive cache keeps the helper call off the hot path; the negative
// cache stops a forged cookie from hammering it.
const SESSION_CACHE_MS = Math.max(0, Number(process.env.SESSION_CACHE_MS) || 60000);
const SESSION_NEGATIVE_CACHE_MS = 10000;
const SESSION_CACHE_MAX = 5000;

const sessionCache = new Map(); // token -> { session, until }

function authConfigured() {
  if (STATE_MODE === 'helper') {
    return Boolean(CLIENT_ID && CALLBACK_URL && HELPER_URL && HELPER_KEY);
  }
  return Boolean(CLIENT_ID && CALLBACK_URL && HELPER_URL && HELPER_KEY && SESSION_SECRET.length >= 16);
}

function normalizeUser(user) {
  return {
    id: Number(user && user.id),
    login: String((user && user.login) || ''),
    avatarUrl: String((user && (user.avatar_url || user.avatarUrl)) || ''),
  };
}

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hmacWith(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest();
}

// Local-mode cookies and (in helper mode) the short-lived OAuth state.
function hmac(value) {
  return hmacWith(STATE_KEY || SESSION_SECRET, value);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// ---------------------------------------------------------------------------
// OAuth state (stateless, signed, short-lived)
// ---------------------------------------------------------------------------

function makeState() {
  const nonce = crypto.randomBytes(16).toString('hex');
  const issued = Date.now();
  const payload = nonce + '.' + issued;
  return payload + '.' + base64url(hmac(payload));
}

function verifyState(state) {
  if (typeof state !== 'string') return false;
  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const payload = parts[0] + '.' + parts[1];
  if (!safeEqual(base64url(hmac(payload)), parts[2])) return false;
  const issued = Number(parts[1]);
  return Number.isFinite(issued) && Date.now() - issued <= STATE_TTL_MS && Date.now() - issued >= 0;
}

function authorizeUrl(state) {
  const query = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: CALLBACK_URL,
    scope: 'read:user',
    state,
  });
  return GITHUB_OAUTH_BASE + '/login/oauth/authorize?' + query.toString();
}

// ---------------------------------------------------------------------------
// Host-side helper client (token exchange, sessions, logout)
// ---------------------------------------------------------------------------

async function helperFetch(pathname, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HELPER_TIMEOUT_MS);
  try {
    const response = await fetch(HELPER_URL + pathname, Object.assign({ signal: controller.signal }, init));
    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    return { status: response.status, payload };
  } catch (err) {
    return { status: 0, payload: null, error: (err && err.message) || String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Exchange the OAuth code on the host helper. In helper mode the response
 * also carries an opaque session token; in local mode the container builds
 * the signed cookie itself.
 * Returns { token, expiresAt, user }.
 */
async function exchangeCode(code, redirectUri) {
  if (!authConfigured()) {
    throw Object.assign(new Error('Sign-in is not configured'), { statusCode: 503 });
  }
  const { status, payload, error } = await helperFetch('/exchange', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Helper-Key': HELPER_KEY,
    },
    body: JSON.stringify({ code: String(code), redirect_uri: String(redirectUri) }),
  });
  if (status === 0) {
    throw Object.assign(new Error('Auth helper unreachable: ' + error), { statusCode: 502 });
  }
  if (status !== 200 || !payload || payload.ok !== true || !payload.user || typeof payload.user.id !== 'number') {
    const reason = payload && payload.error ? String(payload.error) : 'HTTP ' + status;
    throw Object.assign(new Error('GitHub sign-in failed: ' + reason), { statusCode: 502 });
  }
  const user = normalizeUser(payload.user);
  if (STATE_MODE === 'helper') {
    if (!payload.token) {
      throw Object.assign(new Error('Auth helper returned no session token'), { statusCode: 502 });
    }
    return { token: String(payload.token), expiresAt: String(payload.expiresAt || ''), user };
  }
  return { token: null, expiresAt: null, user };
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function sessionCookieFlags() {
  const secure = process.env.COOKIE_SECURE === '0'
    ? false
    : process.env.COOKIE_SECURE === '1' || CALLBACK_URL.startsWith('https://');
  return '; HttpOnly; SameSite=Lax; Path=/' + (secure ? '; Secure' : '');
}

function createSession(user) {
  const issued = Date.now();
  const payload = base64url(JSON.stringify({
    id: user.id,
    login: user.login,
    avatar: user.avatarUrl,
    iat: issued,
    exp: issued + SESSION_TTL_MS,
  }));
  return payload + '.' + base64url(hmacWith(SESSION_SECRET, payload));
}

function readSignedSession(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  if (!safeEqual(base64url(hmacWith(SESSION_SECRET, parts[0])), parts[1])) return null;
  let data = null;
  try {
    data = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data.id !== 'number' || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
  return {
    token,
    user: { id: data.id, login: String(data.login || ''), avatarUrl: String(data.avatar || '') },
    expiresAt: new Date(data.exp).toISOString(),
  };
}

function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((pair) => {
    const index = pair.indexOf('=');
    if (index <= 0) return;
    out[pair.slice(0, index).trim()] = pair.slice(index + 1).trim();
  });
  return out;
}

function cacheSession(token, session) {
  if (sessionCache.size >= SESSION_CACHE_MAX) {
    const now = Date.now();
    for (const [key, entry] of sessionCache) {
      if (entry.until <= now) sessionCache.delete(key);
    }
    if (sessionCache.size >= SESSION_CACHE_MAX) sessionCache.clear();
  }
  sessionCache.set(token, { session, until: Date.now() + (session ? SESSION_CACHE_MS : SESSION_NEGATIVE_CACHE_MS) });
}

/**
 * Resolve the request's session: a signed cookie in local mode, a cached
 * helper lookup in helper mode. Returns { token, user, expiresAt } or null.
 */
async function userFromRequest(req) {
  const cookies = parseCookies(req.headers && req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  if (STATE_MODE !== 'helper') return readSignedSession(token);

  const cached = sessionCache.get(token);
  if (cached && cached.until > Date.now()) return cached.session;
  if (cached) sessionCache.delete(token);

  const { status, payload } = await helperFetch('/session', {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (status === 200 && payload && payload.ok === true && payload.user && typeof payload.user.id === 'number') {
    const session = { token, user: normalizeUser(payload.user), expiresAt: String(payload.expiresAt || '') };
    cacheSession(token, session);
    return session;
  }
  if (status === 401) {
    cacheSession(token, null);
    return null;
  }
  // Helper unreachable: fail closed. Cached entries expire within
  // SESSION_CACHE_MS, and users can sign in again once the helper is back.
  return null;
}

/** Revoke the session host-side (helper mode) and drop the local cache. */
async function endSession(req) {
  const cookies = parseCookies(req.headers && req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return;
  if (STATE_MODE !== 'helper') return;
  sessionCache.delete(token);
  await helperFetch('/session/logout', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
  });
}

function sessionSetCookie(session) {
  if (STATE_MODE === 'helper') {
    const expires = Date.parse(session.expiresAt || '');
    const maxAge = Number.isFinite(expires)
      ? Math.max(1, Math.floor((expires - Date.now()) / 1000))
      : Math.floor(SESSION_TTL_MS / 1000);
    return SESSION_COOKIE + '=' + session.token + '; Max-Age=' + maxAge + sessionCookieFlags();
  }
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return SESSION_COOKIE + '=' + createSession(session.user) + '; Max-Age=' + maxAge + sessionCookieFlags();
}

function sessionClearCookie() {
  return SESSION_COOKIE + '=; Max-Age=0' + sessionCookieFlags();
}

module.exports = {
  stateMode: STATE_MODE,
  authConfigured,
  authorizeUrl,
  makeState,
  verifyState,
  exchangeCode,
  userFromRequest,
  endSession,
  sessionSetCookie,
  sessionClearCookie,
  parseCookies,
};
