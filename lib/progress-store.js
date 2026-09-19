// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
//
// Per-account progress storage for optional sign-in (C2). One JSON document
// per GitHub account, written atomically under PLAYGROUND_DATA_DIR. No
// database; the document shape is the B3 export (docs/PROGRESS_SYNC.md).
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.PLAYGROUND_DATA_DIR || path.join(__dirname, '..', 'data');
const ACCOUNTS_DIR = path.join(DATA_DIR, 'accounts');
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

function readProgress(userId) {
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

/**
 * Store a document if baseRevision matches the stored revision (or the caller
 * passes null for first write). Returns { conflict, ... } when the stored
 * revision has moved on since the caller read it.
 */
function writeProgress(userId, document, baseRevision) {
  const normalized = sanitizeDocument(document);
  const serialized = JSON.stringify(normalized);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_DOC_BYTES) {
    throw Object.assign(new Error('Progress document exceeds 1 MiB'), { statusCode: 413 });
  }

  const current = readProgress(userId);
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

function deleteProgress(userId) {
  try {
    fs.unlinkSync(accountFile(userId));
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  dataDir: DATA_DIR,
  readProgress,
  writeProgress,
  deleteProgress,
};
