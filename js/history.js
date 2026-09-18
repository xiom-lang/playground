// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
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

/**
 * B4 adapter. There is no account system yet, so this is a local no-op; the
 * registry contract it must implement is docs/PROGRESS_SYNC.md. Keeping the
 * single entry point means the UI will not change when sync becomes real.
 */
function syncProgress() {
  return Promise.resolve({
    ok: false,
    synced: false,
    reason: 'No account yet. Progress stays in this browser.',
  });
}

function showSyncStatus() {
  return syncProgress().then(function (result) {
    setProgressNotice(result.reason, result.ok);
    return result;
  });
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
window.showSyncStatus = showSyncStatus;
