// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Local learning history and progress backup.
//
// Everything is stored in localStorage under versioned keys; no network and no
// account. The export format is the pre-account backup path and doubles as the
// payload contract for the future registry sync (docs/PROGRESS_SYNC.md).
var HISTORY_KEY = 'xiom_history_v1';
var HISTORY_MAX_PER_LESSON = 20;
var HISTORY_MAX_TOTAL = 400;

function readHistoryStore() {
  try {
    var raw = localStorage.getItem(HISTORY_KEY);
    var data = raw ? JSON.parse(raw) : null;
    if (!data || typeof data !== 'object' || !data.lessons || typeof data.lessons !== 'object') {
      return { version: 1, lessons: {}, last: null, updated: null };
    }
    if (Array.isArray(data.lessons)) data.lessons = {};
    return data;
  } catch (err) {
    return { version: 1, lessons: {}, last: null, updated: null };
  }
}

function writeHistoryStore(store) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(store));
    return true;
  } catch (err) {
    return false;
  }
}

function countHistoryRuns(store) {
  var total = 0;
  Object.keys((store && store.lessons) || {}).forEach(function (id) {
    var list = store.lessons[id];
    if (Array.isArray(list)) total += list.length;
  });
  return total;
}

/** Drop the oldest entries when the store exceeds its global cap. */
function pruneHistory(store) {
  var entries = [];
  Object.keys(store.lessons || {}).forEach(function (id) {
    var list = store.lessons[id];
    if (!Array.isArray(list)) { delete store.lessons[id]; return; }
    list.forEach(function (entry) {
      if (entry && typeof entry.t === 'number') entries.push({ id: id, entry: entry });
    });
  });
  var excess = entries.length - HISTORY_MAX_TOTAL;
  if (excess <= 0) return store;

  entries.sort(function (a, b) { return a.entry.t - b.entry.t; });
  var kept = {};
  for (var i = excess; i < entries.length; i++) {
    var id = entries[i].id;
    (kept[id] || (kept[id] = [])).push(entries[i].entry);
  }
  Object.keys(kept).forEach(function (id) {
    kept[id].sort(function (a, b) { return b.t - a.t; });
  });
  store.lessons = kept;
  return store;
}

/** Append a completed run for a lesson (newest first, capped per lesson). */
function recordRun(lessonId, run) {
  if (!lessonId) return;
  var store = readHistoryStore();
  var list = store.lessons[lessonId] || (store.lessons[lessonId] = []);
  var output = run && run.runOutput != null ? run.runOutput : (run && run.output) || '';
  list.unshift({
    t: Date.now(),
    ok: !!(run && run.success),
    timeout: !!(run && run.timedOut),
    ms: (run && run.elapsedMs) || 0,
    out: String(output).replace(/\r\n/g, '\n').slice(0, 400),
  });
  if (list.length > HISTORY_MAX_PER_LESSON) list.length = HISTORY_MAX_PER_LESSON;
  store.version = 1;
  store.updated = new Date().toISOString();
  pruneHistory(store);
  writeHistoryStore(store);
  if (typeof scheduleSync === 'function') scheduleSync();
}

/** Newest-first run list for a lesson (may be empty). */
function historyFor(lessonId) {
  var store = readHistoryStore();
  var list = store.lessons[lessonId];
  return Array.isArray(list) ? list.slice() : [];
}

function historySummary() {
  var store = readHistoryStore();
  var runs = 0;
  var passed = 0;
  var lessons = 0;
  var lastAt = 0;
  Object.keys(store.lessons || {}).forEach(function (id) {
    var list = store.lessons[id];
    if (!Array.isArray(list) || list.length === 0) return;
    lessons++;
    list.forEach(function (entry) {
      runs++;
      if (entry.ok) passed++;
      if ((entry.t || 0) > lastAt) lastAt = entry.t || 0;
    });
  });
  return { runs: runs, passed: passed, lessons: lessons, lastAt: lastAt || null };
}

function historyClearLesson(lessonId) {
  var store = readHistoryStore();
  delete store.lessons[lessonId];
  store.updated = new Date().toISOString();
  writeHistoryStore(store);
}

function historyClearAll() {
  try { localStorage.removeItem(HISTORY_KEY); } catch (err) { /* ignore */ }
}

/** Remember the lesson a learner last opened so the landing can resume it. */
function rememberLesson(lessonId, lessonFile, title) {
  if (!lessonId || !lessonFile) return;
  var store = readHistoryStore();
  store.last = { id: lessonId, file: lessonFile, title: title || lessonId, t: Date.now() };
  writeHistoryStore(store);
}

function lastLesson() {
  var store = readHistoryStore();
  return store.last && store.last.id ? store.last : null;
}

function mergeHistory(a, b) {
  var out = {};
  [a || {}, b || {}].forEach(function (src) {
    Object.keys(src).forEach(function (id) {
      var list = src[id];
      if (!Array.isArray(list)) return;
      var target = out[id] || (out[id] = []);
      list.forEach(function (entry) {
        if (!entry || typeof entry.t !== 'number') return;
        for (var i = 0; i < target.length; i++) if (target[i].t === entry.t) return;
        target.push(entry);
      });
      target.sort(function (x, y) { return (y.t || 0) - (x.t || 0); });
      if (target.length > HISTORY_MAX_PER_LESSON) target.length = HISTORY_MAX_PER_LESSON;
    });
  });
  return out;
}

function formatRelativeTime(ts) {
  if (!ts) return '';
  var diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  var mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + 'm ago';
  var hours = Math.floor(mins / 60);
  if (hours < 24) return hours + 'h ago';
  var days = Math.floor(hours / 24);
  if (days < 30) return days + 'd ago';
  return new Date(ts).toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// History UI
// ---------------------------------------------------------------------------

function renderHistoryBlock(lessonId) {
  var host = document.getElementById('lessonHistory');
  if (!host || !lessonId) return;
  host.innerHTML = '';

  var runs = historyFor(lessonId);
  var header = document.createElement('div');
  header.className = 'history-header';

  var title = document.createElement('span');
  title.className = 'history-title';
  title.textContent = 'Recent runs';
  header.appendChild(title);

  if (runs.length > 0) {
    var clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'history-clear';
    clear.textContent = 'Clear';
    clear.setAttribute('aria-label', 'Clear run history for this lesson');
    clear.onclick = function () {
      historyClearLesson(lessonId);
      renderHistoryBlock(lessonId);
    };
    header.appendChild(clear);
  }
  host.appendChild(header);

  if (runs.length > 0) {
    var hint = document.createElement('div');
    hint.className = 'history-hint';
    hint.textContent = 'Times include native compilation. The first run of new code takes a few seconds; repeats are instant.';
    host.appendChild(hint);
  }

  if (runs.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'No runs yet. Press Run to record one.';
    host.appendChild(empty);
    return;
  }

  var list = document.createElement('ul');
  list.className = 'history-list';
  runs.slice(0, 6).forEach(function (entry) {
    var item = document.createElement('li');
    item.className = 'history-item ' + (entry.ok ? 'ok' : 'fail');

    var dot = document.createElement('span');
    dot.className = 'history-dot';

    var status = document.createElement('span');
    status.className = 'history-status';
    status.textContent = entry.ok ? 'pass' : entry.timeout ? 'timeout' : 'fail';

    var time = document.createElement('span');
    time.className = 'history-time';
    time.textContent = formatRelativeTime(entry.t);

    item.appendChild(dot);
    item.appendChild(status);
    item.appendChild(time);

    if (entry.ms) {
      var ms = document.createElement('span');
      ms.className = 'history-ms';
      ms.textContent = (entry.ms / 1000).toFixed(1) + 's';
      item.appendChild(ms);
    }
    if (entry.ok && entry.out) {
      var preview = document.createElement('span');
      preview.className = 'history-preview';
      preview.textContent = entry.out.replace(/\s+/g, ' ').slice(0, 60);
      item.appendChild(preview);
    }
    list.appendChild(item);
  });
  host.appendChild(list);
}

// ---------------------------------------------------------------------------
// Export / import (B3) and the future sync adapter (B4)
// ---------------------------------------------------------------------------

function buildProgressExport() {
  var progress = window.getProgress ? window.getProgress() : [];
  var store = readHistoryStore();
  return {
    app: 'xiom-playground',
    version: 1,
    exported: new Date().toISOString(),
    progress: { completed: progress },
    last: store.last || null,
    history: {
      version: store.version || 1,
      updated: store.updated || null,
      lessons: store.lessons || {},
    },
  };
}

function setProgressNotice(text, ok) {
  var notice = document.getElementById('progressNotice');
  if (notice) {
    notice.textContent = text || '';
    notice.className = 'progress-notice' + (ok ? ' ok' : '');
  }
}

function exportProgress() {
  var payload = buildProgressExport();
  var json = JSON.stringify(payload, null, 2);
  try {
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = 'xiom-progress-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    setProgressNotice('Progress exported as a JSON file.', true);
    return true;
  } catch (err) {
    setProgressNotice('Export failed: ' + err.message, false);
    return false;
  }
}

function importProgressPayload(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, error: 'not a progress file' };
  var completed = payload.progress && Array.isArray(payload.progress.completed)
    ? payload.progress.completed.filter(function (id) { return typeof id === 'string'; })
    : [];
  var incomingHistory = (payload.history && payload.history.lessons) || null;
  if (completed.length === 0 && !incomingHistory) return { ok: false, error: 'no progress in the file' };

  var existing = window.getProgress ? window.getProgress() : [];
  var merged = existing.slice();
  completed.forEach(function (id) { if (merged.indexOf(id) === -1) merged.push(id); });
  try {
    localStorage.setItem('xiom_lessons_completed', JSON.stringify(merged));
  } catch (err) {
    return { ok: false, error: 'browser storage is full' };
  }

  var store = readHistoryStore();
  store.lessons = mergeHistory(store.lessons, incomingHistory || {});
  if (payload.last && payload.last.id && payload.last.file) {
    if (!store.last || (payload.last.t || 0) > (store.last.t || 0)) store.last = payload.last;
  }
  store.version = 1;
  store.updated = new Date().toISOString();
  pruneHistory(store);
  writeHistoryStore(store);

  return { ok: true, added: merged.length - existing.length, runs: countHistoryRuns(store) };
}

function importProgressFromInput(input) {
  var file = input && input.files && input.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    var payload = null;
    try { payload = JSON.parse(String(reader.result)); } catch (err) { payload = null; }
    var result = importProgressPayload(payload);
    setProgressNotice(result.ok
      ? 'Progress imported: ' + result.added + ' new lesson(s), ' + result.runs + ' stored run(s).'
      : 'Import failed: ' + result.error + '.', result.ok);
    var status = document.getElementById('status');
    if (status) {
      status.textContent = result.ok
        ? 'Progress imported: ' + result.added + ' new lesson(s), ' + result.runs + ' stored run(s).'
        : 'Import failed: ' + result.error + '.';
      status.className = 'status-bar ' + (result.ok ? 'ok' : 'err');
    }
    if (result.ok) {
      if (window.lessonCatalogCache && window.renderLessonList) window.renderLessonList(window.lessonCatalogCache);
      if (window.updateProgressSummary) window.updateProgressSummary();
      if (window.checkLastProgress) window.checkLastProgress();
    }
  };
  reader.onerror = function () {
    setProgressNotice('Import failed: the file could not be read.', false);
    var status = document.getElementById('status');
    if (status) {
      status.textContent = 'Import failed: the file could not be read.';
      status.className = 'status-bar err';
    }
  };
  reader.readAsText(file);
  input.value = '';
}

// ---------------------------------------------------------------------------
// Optional GitHub sign-in (C2) and cross-device sync
// ---------------------------------------------------------------------------

var authState = { configured: false, user: null, checked: false };

function refreshAuthState() {
  return fetch('/api/auth/config')
    .then(function (response) { return response.ok ? response.json() : { configured: false }; })
    .then(function (config) {
      authState.configured = Boolean(config && config.configured);
      authState.user = config && config.user ? config.user : null;
      authState.checked = true;
      renderAuthUi();
      var params = new URLSearchParams(window.location.search);
      var authResult = params.get('auth');
      if (authResult === 'ok') {
        window.history.replaceState(null, '', window.location.pathname);
        if (authState.user) {
          setProgressNotice('Signed in as ' + authState.user.login + '. Syncing...', true);
          syncProgress();
        }
      } else if (authResult === 'error') {
        window.history.replaceState(null, '', window.location.pathname);
        setProgressNotice('Sign-in failed. Please try again.', false);
      }
      return authState;
    })
    .catch(function () {
      authState.configured = false;
      authState.user = null;
      renderAuthUi();
      return authState;
    });
}

function renderAuthUi() {
  var signIn = document.getElementById('authSignIn');
  var userBox = document.getElementById('authUser');
  var signedIn = Boolean(authState.user);
  if (signIn) signIn.classList.toggle('hidden', !authState.configured || signedIn);
  if (userBox) userBox.classList.toggle('hidden', !signedIn);
  if (signedIn) {
    var name = document.getElementById('authUserName');
    if (name) name.textContent = authState.user.login;
    var avatar = document.getElementById('authAvatar');
    if (avatar) {
      avatar.src = authState.user.avatarUrl || '';
      avatar.alt = authState.user.login + ' avatar';
    }
  }
  var syncBtn = document.getElementById('progressSyncBtn');
  if (syncBtn) syncBtn.classList.toggle('hidden', !signedIn);
  var landingSignIn = document.getElementById('authSignInLanding');
  if (landingSignIn) landingSignIn.classList.toggle('hidden', !authState.configured || signedIn);
}

function signIn() {
  window.location.href = '/auth/github';
}

function signOut() {
  fetch('/auth/logout', { method: 'POST' })
    .catch(function () { /* clearing the cookie client-side is best effort */ })
    .then(function () {
      authState.user = null;
      renderAuthUi();
      setProgressNotice('Signed out. Progress stays in this browser.', true);
    });
}

function documentParts(doc) {
  return {
    completed: (doc && doc.progress && doc.progress.completed) || [],
    last: (doc && doc.last) || null,
    lessons: (doc && doc.history && doc.history.lessons) || {},
  };
}

function documentsDiffer(a, b) {
  return JSON.stringify(documentParts(a)) !== JSON.stringify(documentParts(b));
}

function mergeDocuments(local, remote) {
  var left = documentParts(local);
  var right = documentParts(remote);
  var completed = left.completed.slice();
  right.completed.forEach(function (id) { if (completed.indexOf(id) === -1) completed.push(id); });
  var last = left.last;
  if (right.last && (!last || (right.last.t || 0) > (last.t || 0))) last = right.last;
  return {
    app: 'xiom-playground',
    version: 1,
    exported: new Date().toISOString(),
    progress: { completed: completed },
    last: last,
    history: { version: 1, updated: new Date().toISOString(), lessons: mergeHistory(left.lessons, right.lessons) },
  };
}

function putProgress(document, baseRevision) {
  return fetch('/api/progress', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseRevision: baseRevision === undefined ? null : baseRevision,
      document: document,
    }),
  }).then(function (response) {
    if (response.status === 409) {
      return response.json().then(function (data) {
        return { conflict: true, revision: data.revision, document: data.document };
      });
    }
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json().then(function (data) {
      return { conflict: false, revision: data.revision };
    });
  });
}

/** Write a merged document back into local storage so remote-only data shows. */
function applyRemoteDocument(doc) {
  var parts = documentParts(doc);
  try {
    localStorage.setItem('xiom_lessons_completed', JSON.stringify(parts.completed));
  } catch (err) { /* storage full: keep serving from memory */ }
  var store = readHistoryStore();
  store.lessons = parts.lessons;
  if (parts.last) store.last = parts.last;
  store.updated = new Date().toISOString();
  writeHistoryStore(store);
  if (window.lessonCatalogCache && window.renderLessonList) window.renderLessonList(window.lessonCatalogCache);
  if (window.updateProgressSummary) window.updateProgressSummary();
  if (window.checkLastProgress) window.checkLastProgress();
}

/**
 * Sync with the playground backend when signed in. Local storage remains the
 * source of truth when signed out; the merge rules match the export/import
 * path (union of completed lessons, history merged by timestamp).
 */
function syncProgress() {
  if (!authState.configured) {
    return Promise.resolve({ ok: false, synced: false, reason: 'Sign-in is not configured on this server.' });
  }
  if (!authState.user) {
    return Promise.resolve({ ok: false, synced: false, reason: 'Sign in to sync progress across devices.' });
  }
  var localDoc = buildProgressExport();
  return fetch('/api/progress')
    .then(function (response) {
      if (response.status === 401) throw new Error('Session expired; sign in again.');
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.json();
    })
    .then(function (remote) {
      var merged = mergeDocuments(localDoc, remote.document);
      if (remote.document && !documentsDiffer(merged, remote.document)) {
        // The server already holds the merged state; adopt it locally so a
        // fresh browser (or a cleared localStorage) gets its progress back.
        applyRemoteDocument(merged);
        return { ok: true, synced: true, changed: false, revision: remote.revision };
      }
      return putProgress(merged, remote.revision).then(function (result) {
        if (result.conflict) {
          var resolved = mergeDocuments(localDoc, result.document);
          return putProgress(resolved, result.revision).then(function (second) {
            applyRemoteDocument(resolved);
            return { ok: true, synced: true, changed: true, revision: second.revision };
          });
        }
        applyRemoteDocument(merged);
        return { ok: true, synced: true, changed: true, revision: result.revision };
      });
    })
    .catch(function (err) {
      return { ok: false, synced: false, reason: (err && err.message) || 'Sync failed.' };
    });
}

var syncTimer = null;

function scheduleSync() {
  if (!authState.user) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(function () {
    syncProgress().then(function (result) {
      if (result.ok && result.synced && result.changed) setProgressNotice('Progress synced.', true);
    });
  }, 4000);
}

function syncNow() {
  if (!authState.configured) {
    setProgressNotice('Sign-in is not configured on this server.', false);
    return Promise.resolve({ ok: false, synced: false, reason: 'not configured' });
  }
  if (!authState.user) {
    setProgressNotice('Sign in to sync progress across devices.', false);
    return Promise.resolve({ ok: false, synced: false, reason: 'not signed in' });
  }
  setProgressNotice('Syncing...', true);
  return syncProgress().then(function (result) {
    if (result.ok && result.synced) setProgressNotice('Progress synced.', true);
    else setProgressNotice(result.reason || 'Sync failed.', false);
    return result;
  });
}

function deleteAccount() {
  if (!window.confirm('Delete your account and all synced progress on this server?')) return Promise.resolve(false);
  return fetch('/api/me', { method: 'DELETE' }).then(function (response) {
    if (!response.ok) return false;
    authState.user = null;
    renderAuthUi();
    setProgressNotice('Account data deleted.', true);
    return true;
  }).catch(function () { return false; });
}

window.recordRun = recordRun;
window.historyFor = historyFor;
window.historySummary = historySummary;
window.historyClearLesson = historyClearLesson;
window.historyClearAll = historyClearAll;
window.rememberLesson = rememberLesson;
window.lastLesson = lastLesson;
window.renderHistoryBlock = renderHistoryBlock;
window.formatRelativeTime = formatRelativeTime;
window.buildProgressExport = buildProgressExport;
window.exportProgress = exportProgress;
window.importProgressPayload = importProgressPayload;
window.importProgressFromInput = importProgressFromInput;
window.syncProgress = syncProgress;
window.syncNow = syncNow;
window.scheduleSync = scheduleSync;
window.refreshAuthState = refreshAuthState;
window.signIn = signIn;
window.signOut = signOut;
window.deleteAccount = deleteAccount;
