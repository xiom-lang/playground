// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
//
// Per-account progress storage for optional sign-in (C2). One JSON document
// per GitHub account; the document shape is the B3 export
// (docs/PROGRESS_SYNC.md), sanitized here before anything is stored.
//
// Two storage modes, selected with PLAYGROUND_STATE:
//
//   local (default) -- documents live on the playground-data volume in the
//     container, written atomically with revision checks.
//   helper -- P2: documents live on the host-side helper
//     (/opt/xiom/playground-state, docs/P2_STATE_HELPER_DESIGN.md) and are
//     reached with the caller's session token, so the container holds no
//     multi-tenant data. The revision/conflict semantics are unchanged.
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STATE_MODE = process.env.PLAYGROUND_STATE === 'helper' ? 'helper' : 'local';
const DATA_DIR = process.env.PLAYGROUND_DATA_DIR || path.join(__dirname, '..', 'data');
const ACCOUNTS_DIR = path.join(DATA_DIR, 'accounts');
const HELPER_URL = (process.env.AUTH_HELPER_URL || '').replace(/\/+$/, '');
const HELPER_TIMEOUT_MS = Math.max(1000, Number(process.env.AUTH_HELPER_TIMEOUT_MS) || 8000);
const MAX_DOC_BYTES = 1024 * 1024;
const MAX_COMPLETED = 5000;
const MAX_HISTORY_LESSONS = 500;
const MAX_RUNS_PER_LESSON = 20;
const MAX_OUT_CHARS = 400;

function accountFile(userId) {
  const safeId = String(userId).replace(/[^0-9]/g, '');
  return path.join(ACCOUNTS_DIR, safeId + '.json');
}

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function userIdOf(session) {
  const id = session && session.user ? session.user.id : null;
  if (id === null || id === undefined) {
    throw Object.assign(new Error('Not signed in'), { statusCode: 401 });
  }
  return id;
}

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
  } catch {
    return { status: 0, payload: null };
  } finally {
    clearTimeout(timer);
  }
}

function sanitizeDocument(input) {
  if (!input || typeof input !== 'object') throw badRequest('document must be an object');

  const completed = [];
  const rawCompleted = input.progress && Array.isArray(input.progress.completed) ? input.progress.completed : [];
  for (const value of rawCompleted) {
    if (typeof value !== 'string') continue;
    const id = value.slice(0, 32);
    if (!/^[A-Za-z0-9._-]+$/.test(id)) continue;
    if (!completed.includes(id) && completed.length < MAX_COMPLETED) completed.push(id);
  }

  const lessons = {};
  const rawLessons = input.history && input.history.lessons && typeof input.history.lessons === 'object'
    ? input.history.lessons
    : {};
  for (const lessonId of Object.keys(rawLessons).slice(0, MAX_HISTORY_LESSONS)) {
    if (!/^[A-Za-z0-9._-]{1,32}$/.test(lessonId)) continue;
    const runs = Array.isArray(rawLessons[lessonId]) ? rawLessons[lessonId] : [];
    lessons[lessonId] = runs.slice(0, MAX_RUNS_PER_LESSON).map((run) => ({
      t: Number(run && run.t) || 0,
      ok: Boolean(run && run.ok),
      timeout: Boolean(run && run.timeout),
      ms: Math.max(0, Math.min(3600000, Number(run && run.ms) || 0)),
      out: String((run && run.out) || '').slice(0, MAX_OUT_CHARS),
    }));
  }

  let last = null;
  if (input.last && typeof input.last === 'object' && typeof input.last.id === 'string') {
    last = {
      id: input.last.id.slice(0, 32),
      file: String(input.last.file || '').slice(0, 120),
      title: String(input.last.title || '').slice(0, 120),
      t: Number(input.last.t) || 0,
    };
  }

  return {
    app: 'xiom-playground',
    version: 1,
    exported: new Date().toISOString(),
    progress: { completed },
    last,
    history: {
      version: 1,
      updated: input.history && input.history.updated ? String(input.history.updated).slice(0, 40) : null,
      lessons,
    },
  };
}

// ---------------------------------------------------------------------------
// Local (container volume) storage
// ---------------------------------------------------------------------------

function readLocal(userId) {
  let raw;
  try {
    raw = fs.readFileSync(accountFile(userId), 'utf8');
  } catch {
    return null;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || !data.document) return null;
  return {
    revision: String(data.revision || ''),
    updated: String(data.updated || ''),
    document: data.document,
  };
}

function writeLocal(userId, normalized, baseRevision) {
  const current = readLocal(userId);
  const expected = baseRevision === undefined || baseRevision === null ? null : String(baseRevision);
  if (current && current.revision !== expected) {
    return { conflict: true, current };
  }

  const record = {
    revision: crypto.randomUUID(),
    updated: new Date().toISOString(),
    document: normalized,
  };
  fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
  const file = accountFile(userId);
  const temp = file + '.tmp-' + crypto.randomBytes(6).toString('hex');
  fs.writeFileSync(temp, JSON.stringify(record), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(temp, file);
  return { conflict: false, revision: record.revision, updated: record.updated };
}

function deleteLocal(userId) {
  try {
    fs.unlinkSync(accountFile(userId));
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API (async in both modes; session carries token and user)
// ---------------------------------------------------------------------------

/** @returns {Promise<{revision, updated, document}|null>} */
async function readProgress(session) {
  if (STATE_MODE === 'helper') {
    const { status, payload } = await helperFetch('/progress', {
      headers: { Authorization: 'Bearer ' + session.token },
    });
    if (status !== 200 || !payload || payload.ok !== true) {
      throw Object.assign(new Error('Progress helper unavailable (HTTP ' + status + ')'), { statusCode: 502 });
    }
    if (!payload.found) return null;
    return {
      revision: String(payload.revision || ''),
      updated: String(payload.updated || ''),
      document: payload.document,
    };
  }
  return readLocal(userIdOf(session));
}

/** @returns {Promise<{conflict:boolean, revision?, updated?, current?}>} */
async function writeProgress(session, document, baseRevision) {
  const normalized = sanitizeDocument(document);
  if (Buffer.byteLength(JSON.stringify(normalized), 'utf8') > MAX_DOC_BYTES) {
    throw Object.assign(new Error('Progress document exceeds 1 MiB'), { statusCode: 413 });
  }
  if (STATE_MODE === 'helper') {
    const { status, payload } = await helperFetch('/progress', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + session.token,
      },
      body: JSON.stringify({
        document: normalized,
        baseRevision: baseRevision === undefined || baseRevision === null ? null : String(baseRevision),
      }),
    });
    if (status === 409 && payload) {
      return {
        conflict: true,
        current: {
          revision: String(payload.revision || ''),
          updated: String(payload.updated || ''),
          document: payload.document,
        },
      };
    }
    if (status !== 200 || !payload || payload.ok !== true) {
      throw Object.assign(new Error('Progress helper unavailable (HTTP ' + status + ')'), { statusCode: 502 });
    }
    return { conflict: false, revision: String(payload.revision || ''), updated: String(payload.updated || '') };
  }
  return writeLocal(userIdOf(session), normalized, baseRevision);
}

/** @returns {Promise<boolean>} */
async function deleteProgress(session) {
  if (STATE_MODE === 'helper') {
    const { status } = await helperFetch('/progress', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + session.token },
    });
    return status === 200;
  }
  return deleteLocal(userIdOf(session));
}

module.exports = {
  stateMode: STATE_MODE,
  dataDir: STATE_MODE === 'helper' ? null : DATA_DIR,
  readProgress,
  writeProgress,
  deleteProgress,
};
