// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
//
// Optional GitHub sign-in (C2). The OAuth code exchange runs on the host-side
// auth helper (DEPLOY.md "Accounts (C2)"), so this process never sees the
// GitHub client secret and the container needs no egress. Sessions are
// stateless HMAC-signed cookies; the GitHub token is discarded by the helper.
'use strict';

const crypto = require('crypto');

const CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const CALLBACK_URL = process.env.OAUTH_CALLBACK_URL || '';
const HELPER_URL = (process.env.AUTH_HELPER_URL || '').replace(/\/+$/, '');
const HELPER_KEY = process.env.AUTH_HELPER_KEY || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const GITHUB_OAUTH_BASE = (process.env.GITHUB_OAUTH_BASE || 'https://github.com').replace(/\/+$/, '');

const SESSION_COOKIE = 'xiom_session';
const SESSION_TTL_MS = Math.max(1, Number(process.env.SESSION_TTL_HOURS) || 720) * 3600 * 1000;
const STATE_TTL_MS = 10 * 60 * 1000;
const HELPER_TIMEOUT_MS = Math.max(1000, Number(process.env.AUTH_HELPER_TIMEOUT_MS) || 8000);

function authConfigured() {
  return Boolean(CLIENT_ID && CALLBACK_URL && HELPER_URL && HELPER_KEY && SESSION_SECRET.length >= 16);
}

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hmac(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest();
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
// Host-side helper client (token exchange + profile)
// ---------------------------------------------------------------------------

async function exchangeCode(code, redirectUri) {
  if (!authConfigured()) {
    throw Object.assign(new Error('Sign-in is not configured'), { statusCode: 503 });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HELPER_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(HELPER_URL + '/exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Helper-Key': HELPER_KEY,
      },
      body: JSON.stringify({ code: String(code), redirect_uri: String(redirectUri) }),
      signal: controller.signal,
    });
  } catch (err) {
    throw Object.assign(new Error('Auth helper unreachable: ' + (err && err.message || err)), { statusCode: 502 });
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok || !payload || payload.ok !== true || !payload.user || typeof payload.user.id !== 'number') {
    const reason = payload && payload.error ? String(payload.error) : 'HTTP ' + response.status;
    throw Object.assign(new Error('GitHub sign-in failed: ' + reason), { statusCode: 502 });
  }
  return {
    id: payload.user.id,
    login: String(payload.user.login || ''),
    avatarUrl: String(payload.user.avatar_url || ''),
  };
}

// ---------------------------------------------------------------------------
// Sessions (stateless signed cookies)
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
  return payload + '.' + base64url(hmac(payload));
}

function readSession(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  if (!safeEqual(base64url(hmac(parts[0])), parts[1])) return null;
  let data = null;
  try {
    data = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
  if (!data || typeof data.id !== 'number' || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
  return { id: data.id, login: String(data.login || ''), avatarUrl: String(data.avatar || '') };
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

function userFromRequest(req) {
  const cookies = parseCookies(req.headers && req.headers.cookie);
  return readSession(cookies[SESSION_COOKIE]);
}

function sessionSetCookie(user) {
  const maxAge = Math.floor(SESSION_TTL_MS / 1000);
  return SESSION_COOKIE + '=' + createSession(user) + '; Max-Age=' + maxAge + sessionCookieFlags();
}

function sessionClearCookie() {
  return SESSION_COOKIE + '=; Max-Age=0' + sessionCookieFlags();
}

module.exports = {
  authConfigured,
  authorizeUrl,
  makeState,
  verifyState,
  exchangeCode,
  userFromRequest,
  sessionSetCookie,
  sessionClearCookie,
  parseCookies,
};
