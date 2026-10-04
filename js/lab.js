// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Algorithm Lab screen: catalog, run pipeline, split player (code + canvas),
// @step line highlighting, keyboard stepping, and compare mode (two panes on
// one shared clock). Zero dependencies, ES5, no bundlers.
'use strict';

var labCatalog = null;
var labEntries = {};          // id -> entry payload (code included)
var labState = {};            // pane -> { entry, code, player, renderer, annotations, lastIndex, running }
var labCompare = false;
var labRafId = null;
var labColorsCache = null;
var labEditors = {};          // pane -> { mode: 'monaco'|'textarea', editor, container }
var labInitialized = false;
var LAB_DEFAULT_SPEED = 4;

function labPrefersReducedMotion() {
  return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function labColors() {
  if (labColorsCache) return labColorsCache;
  var style = window.getComputedStyle(document.documentElement);
  var read = function (name) { return style.getPropertyValue(name).trim(); };
  labColorsCache = {
    void: read('--void'),
    panel: read('--panel'),
    panel2: read('--panel-2'),
    panel3: read('--panel-3'),
    border: read('--border'),
    borderSoft: read('--border-soft'),
    borderHover: read('--border-hover'),
    hi: read('--hi'),
    mid: read('--mid'),
    low: read('--low'),
    indigo: read('--indigo'),
    indigoSoft: read('--indigo-soft'),
    green: read('--green'),
    greenSoft: read('--green-soft'),
    amber: read('--amber'),
    error: read('--error'),
  };
  return labColorsCache;
}

function labInvalidateTheme() {
  labColorsCache = null;
  labRedrawAll();
}

// ---------------------------------------------------------------------------
// Screen wiring
// ---------------------------------------------------------------------------

function openLab() {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('lessonsScreen').classList.add('hidden');
  var screen = document.getElementById('labScreen');
  screen.classList.remove('hidden');
  if (!labInitialized) {
    labInitialized = true;
    labLoadCatalog();
  } else if (labState.A && labState.A.player) {
    labResizeCanvases();
  }
  labStartLoop();
}

function closeLab() {
  labStopLoop();
  document.getElementById('labScreen').classList.add('hidden');
}

function labLoadCatalog() {
  fetch('lessons/lab/index.json')
    .then(function (resp) {
      if (!resp.ok) throw new Error('Lab catalog not found');
      return resp.json();
    })
    .then(function (catalog) {
      labCatalog = catalog;
      labRenderList();
      labRenderPresetOptions();
      var first = labFirstEntry();
      if (first) {
        labState.A = labNewPaneState();
        labState.B = labNewPaneState();
        labSelectEntry('A', first);
      }
    })
    .catch(function () {
      document.getElementById('labList').textContent = 'Failed to load the Lab catalog. Is the server running?';
    });
}

function labFirstEntry() {
  if (!labCatalog) return null;
  for (var i = 0; i < labCatalog.categories.length; i++) {
    var entries = labCatalog.categories[i].entries;
    if (entries.length > 0) return entries[0];
  }
  return null;
}

function labEntryById(id) {
  if (!labCatalog) return null;
  for (var i = 0; i < labCatalog.categories.length; i++) {
    var entries = labCatalog.categories[i].entries;
    for (var j = 0; j < entries.length; j++) {
      if (entries[j].id === id) return entries[j];
    }
  }
  return null;
}

function labOtherEntry(entry, currentId) {
  var category = null;
  for (var i = 0; i < labCatalog.categories.length; i++) {
    if (labCatalog.categories[i].id === entry.category) category = labCatalog.categories[i];
  }
  var pool = category ? category.entries : labCatalog.categories[0].entries;
  for (var j = 0; j < pool.length; j++) {
    if (pool[j].id !== entry.id && pool[j].id !== currentId) return pool[j];
  }
  for (var c = 0; c < labCatalog.categories.length; c++) {
    var all = labCatalog.categories[c].entries;
    for (var k = 0; k < all.length; k++) if (all[k].id !== entry.id) return all[k];
  }
  return entry;
}

function labRenderList() {
  var host = document.getElementById('labList');
  host.innerHTML = '';
  labCatalog.categories.forEach(function (category) {
    var header = document.createElement('div');
    header.className = 'lab-category';
    var icon = document.createElement('span');
    icon.className = 'lab-category-icon';
    icon.textContent = category.icon || '';
    var name = document.createElement('span');
    name.textContent = category.name;
    header.appendChild(icon);
    header.appendChild(name);
    host.appendChild(header);
    category.entries.forEach(function (entry) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'lab-entry';
      button.setAttribute('data-entry-id', entry.id);
      button.innerHTML = '<span class="lab-entry-title"></span><span class="lab-entry-blurb"></span>';
      button.querySelector('.lab-entry-title').textContent = entry.title;
      button.querySelector('.lab-entry-blurb').textContent = entry.blurb;
      button.addEventListener('click', function () { labSelectEntry(labCompare ? 'B' : 'A', entry); });
      button.setAttribute('aria-label', entry.title + ': ' + entry.blurb);
      host.appendChild(button);
    });
  });
}

function labRenderPresetOptions() {
  ['A', 'B'].forEach(function (pane) {
    var select = document.getElementById('labPreset' + pane);
    if (!select) return;
    select.innerHTML = '';
    labCatalog.categories.forEach(function (category) {
      var group = document.createElement('optgroup');
      group.label = category.name;
      category.entries.forEach(function (entry) {
        var option = document.createElement('option');
        option.value = entry.id;
        option.textContent = entry.title;
        group.appendChild(option);
      });
      select.appendChild(group);
    });
  });
}

function labNewPaneState() {
  return {
    entry: null,
    code: '',
    player: null,
    renderer: null,
    annotations: { map: {}, names: [] },
    lastIndex: 0,
    running: false,
    status: 'Idle.',
  };
}

function labMarkActiveListEntry() {
  var activeId = labCompare ? null : (labState.A.entry && labState.A.entry.id);
  document.querySelectorAll('.lab-entry').forEach(function (button) {
    button.classList.toggle('active', button.getAttribute('data-entry-id') === activeId);
  });
}

// ---------------------------------------------------------------------------
// Entry loading and running
// ---------------------------------------------------------------------------

function labSelectEntry(pane, entry) {
  var state = labState[pane];
  if (!state) return;
  state.entry = entry;
  document.getElementById('labPreset' + pane).value = entry.id;
  labSetStatus(pane, 'Loading ' + entry.title + '...');
  fetch('lessons/lab/' + entry.file)
    .then(function (resp) {
      if (!resp.ok) throw new Error('Entry not found: ' + entry.file);
      return resp.json();
    })
    .then(function (payload) {
      state.code = payload.code;
      state.entry = { id: payload.id, title: payload.title, category: payload.category, view: payload.view, blurb: payload.blurb, file: entry.file };
      state.annotations = window.LabTrace.extractAnnotations(payload.code);
      labResetWork(pane);
      labSetEditorCode(pane, payload.code);
      labSetCodePaneDefault(pane);
      if (pane === 'A') {
        document.getElementById('labTitle').textContent = payload.title;
        labMarkActiveListEntry();
      }
      labRunPane(pane);
    })
    .catch(function (err) {
      labSetStatus(pane, err.message);
    });
}

function labResetWork(pane) {
  var state = labState[pane];
  if (state.player) {
    state.player.pause();
    state.player.load([]);
  }
  state.player = null;
  state.renderer = null;
  state.lastIndex = 0;
  labClearDecorations(pane);
  labDrawEmpty(pane);
}

function labSelectPreset(pane, entryId) {
  var entry = labEntryById(entryId);
  if (entry) labSelectEntry(pane, entry);
}

function labRun() {
  labRunPane('A');
  if (labCompare) labRunPane('B');
}

function labRunPane(pane) {
  var state = labState[pane];
  if (!state || !state.entry) return;
  var source = labGetCode(pane) || state.code;
  state.code = source;
  state.running = true;
  labSetStatus(pane, 'Compiling and running...');

  fetch('/api/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: source }),
  })
    .then(function (resp) { return resp.json(); })
    .then(function (run) {
      state.running = false;
      if (!run.success) {
        var message = String(run.runError || run.output || 'Run failed.').split('\n')[0];
        labSetStatus(pane, 'Run failed: ' + message.slice(0, 180));
        labSetStatusClass(pane, 'err');
        return;
      }
      var traceText = run.runOutput != null ? run.runOutput : String(run.output || '');
      var parsed = window.LabTrace.parse(traceText);
      if (parsed.events.length === 0) {
        labSetStatus(pane, 'The program produced no trace events. Is this a Lab program?');
        labSetStatusClass(pane, 'err');
        return;
      }
      if (!parsed.ok || parsed.ignored.length > 0) {
        labSetStatus(pane, 'Trace warning: non-trace output ignored (' + parsed.ignored.length + ' line(s)).');
      } else {
        labSetStatus(pane, 'Ready: ' + parsed.events.length + ' steps in ' + ((run.elapsedMs || 0) / 1000).toFixed(1) + 's.');
      }
      labSetStatusClass(pane, 'ok');
      labLoadTrace(pane, parsed.events);
      var player = state.player;
      if (!labPrefersReducedMotion()) {
        player.play();
      }
    })
    .catch(function () {
      state.running = false;
      labSetStatus(pane, 'Server not reachable.');
      labSetStatusClass(pane, 'err');
    });
}

function labLoadTrace(pane, events) {
  var state = labState[pane];
  state.renderer = window.LabViz.create(state.entry.view, { motion: !labPrefersReducedMotion() });
  state.lastIndex = 0;
  state.player = window.LabPlayer.create({ stepsPerSecond: LAB_DEFAULT_SPEED });
  state.player.onUpdate(function (snapshot) { labOnPlayerUpdate(pane, snapshot); });
  state.player.load(events);
  var max = Math.max(labState.A.player ? labState.A.player.getState().total : 0,
    labState.B && labState.B.player ? labState.B.player.getState().total : 0);
  var scrub = document.getElementById('labScrub');
  scrub.max = String(max);
  scrub.value = '0';
  labStartLoop();
}

function labOnPlayerUpdate(pane, snapshot) {
  var state = labState[pane];
  if (!state || !state.player) return;
  var index = snapshot.index;
  if (index < state.lastIndex) {
    state.renderer.reset();
    state.lastIndex = 0;
  }
  var events = state.player.getEvents();
  for (var i = state.lastIndex; i < index; i++) window.LabViz.apply(state.renderer, events[i]);
  state.lastIndex = index;
  labDraw(pane, performance.now());
  labUpdateDecorations(pane, snapshot);
  labUpdateCounters(pane, snapshot);
  if (pane === 'A') {
    var scrub = document.getElementById('labScrub');
    if (document.activeElement !== scrub) scrub.value = String(index);
    document.getElementById('labPosition').textContent =
      index + ' / ' + snapshot.total + (labCompare && labState.B.player ? ' (B: ' + labState.B.player.getState().index + ')' : '');
  }
  if (snapshot.status === 'done') {
    var result = snapshot.counters;
    labSetStatus(pane, 'Done: ' + result.steps + ' steps, ' + result.compares + ' compares, ' + result.swaps + ' swaps.');
    labSetStatusClass(pane, 'ok');
  } else if (index > 0) {
    labSetStatus(pane, window.LabViz.describe(snapshot.event));
    labSetStatusClass(pane, '');
  }
}

function labUpdateCounters(pane, snapshot) {
  var host = document.getElementById('labCounters' + pane);
  if (!host) return;
  var counters = snapshot.counters;
  host.textContent = 'steps ' + counters.steps + ' \u00B7 compares ' + counters.compares + ' \u00B7 swaps ' + counters.swaps;
}

function labSetStatus(pane, text) {
  var el = document.getElementById('labStatus' + pane);
  if (el) el.textContent = text;
  var state = labState[pane];
  if (state) state.status = text;
}

function labSetStatusClass(pane, kind) {
  var el = document.getElementById('labStatus' + pane);
  if (!el) return;
  el.className = 'lab-status ' + (kind || '');
}

// ---------------------------------------------------------------------------
// Playback controls
// ---------------------------------------------------------------------------

function labEachPlayer(fn) {
  ['A', 'B'].forEach(function (pane) {
    var state = labState[pane];
    if (state && state.player && (pane === 'A' || labCompare)) fn(state.player, pane);
  });
}

function labToggle() {
  labEachPlayer(function (player) { player.toggle(); });
  labUpdatePlayButton();
}

function labStepFwd() {
  labEachPlayer(function (player) { player.stepForward(); });
  labUpdatePlayButton();
}

function labStepBack() {
  labEachPlayer(function (player) { player.stepBack(); });
  labUpdatePlayButton();
}

function labReset() {
  labEachPlayer(function (player) { player.reset(); });
  labUpdatePlayButton();
}

function labSetSpeed(value) {
  var speed = Number(value) || LAB_DEFAULT_SPEED;
  labEachPlayer(function (player) { player.setSpeed(speed); });
  var label = document.getElementById('labSpeedLabel');
  if (label) label.textContent = speed + '/s';
}

function labSeek(value) {
  labEachPlayer(function (player) { player.seek(value); });
}

function labUpdatePlayButton() {
  var button = document.getElementById('labPlay');
  if (!button) return;
  var playing = false;
  labEachPlayer(function (player) {
    if (player.getState().status === 'playing') playing = true;
  });
  if (button.__labPlaying === playing) return;
  button.__labPlaying = playing;
  button.textContent = playing ? '\u23F8' : '\u25B6';
  button.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}

function labToggleCompare() {
  labCompare = !labCompare;
  var screen = document.getElementById('labScreen');
  screen.classList.toggle('compare', labCompare);
  var button = document.getElementById('labCompareToggle');
  button.classList.toggle('active', labCompare);
  button.setAttribute('aria-pressed', labCompare ? 'true' : 'false');
  document.getElementById('labPaneB').classList.toggle('hidden', !labCompare);
  var single = document.getElementById('labPaneA');
  single.classList.toggle('single', !labCompare);
  if (labCompare) {
    if (!labState.B.entry || (labState.A.entry && labState.B.entry.id === labState.A.entry.id)) {
      var other = labOtherEntry(labState.A.entry, null);
      if (other) labSelectEntry('B', other);
    } else if (!labState.B.player) {
      labRunPane('B');
    }
    labSetSpeed(document.getElementById('labSpeed').value);
  } else {
    var b = labState.B.player;
    if (b) b.pause();
  }
  labSetCodePaneDefault('A');
  labSetCodePaneDefault('B');
  labMarkActiveListEntry();
  labUpdatePlayButton();
  labResizeCanvases();
}

function labSetCodePaneDefault(pane) {
  var paneEl = document.getElementById('labCodePane' + pane);
  var button = document.getElementById('labCodeToggle' + pane);
  if (!paneEl) return;
  var collapsed = labIsNarrow() || labCompare;
  paneEl.classList.toggle('collapsed', collapsed);
  if (button) button.textContent = collapsed ? 'Show code' : 'Hide code';
}

function labToggleCode(pane) {
  var paneEl = document.getElementById('labCodePane' + pane);
  var collapsed = paneEl.classList.toggle('collapsed');
  var button = document.getElementById('labCodeToggle' + pane);
  if (button) button.textContent = collapsed ? 'Show code' : 'Hide code';
  if (!collapsed) {
    var holder = labEditors[pane];
    if (holder && holder.mode === 'monaco' && holder.editor) holder.editor.layout();
  }
  window.setTimeout(labInvalidateTheme, 220);
}

// ---------------------------------------------------------------------------
// Editors (Monaco on desktop, textarea on narrow screens)
// ---------------------------------------------------------------------------

function labIsNarrow() {
  return !!(window.isNarrowViewport && window.isNarrowViewport());
}

function labEnsureEditor(pane) {
  var container = document.getElementById('labEditor' + pane);
  if (!container) return;
  var wanted = labIsNarrow() ? 'textarea' : 'monaco';
  var current = labEditors[pane];
  if (current && current.mode === wanted && current.container === container) return;

  if (current && current.mode === 'monaco' && current.editor) {
    current.editor.dispose();
  }
  container.innerHTML = '';
  if (wanted === 'textarea') {
    var edit = document.createElement('div');
    edit.className = 'lab-code-edit';
    var highlight = document.createElement('div');
    highlight.className = 'lab-code-highlight';
    highlight.setAttribute('aria-hidden', 'true');
    var area = document.createElement('textarea');
    area.className = 'lab-code-textarea';
    area.spellcheck = false;
    area.setAttribute('aria-label', 'Lab program code');
    area.value = (labState[pane] && labState[pane].code) || '';
    area.addEventListener('input', function () {
      if (labState[pane]) labState[pane].code = area.value;
    });
    area.addEventListener('scroll', function () {
      var holder = labEditors[pane];
      if (holder) labPositionTextareaHighlight(pane, holder.highlightLines || []);
    });
    edit.appendChild(highlight);
    edit.appendChild(area);
    container.appendChild(edit);
    labEditors[pane] = { mode: 'textarea', editor: area, highlightEl: highlight, highlightLines: [], container: container };
  } else {
    var paneState = labState[pane];
    window.loadMonaco(function () {
      if (!document.getElementById('labEditor' + pane)) return;
      container.innerHTML = '';
      var editor = window.createEditor('labEditor' + pane, (paneState && paneState.code) || '');
      editor.onDidChangeModelContent(function () {
        if (labState[pane]) labState[pane].code = editor.getValue();
      });
      labEditors[pane] = { mode: 'monaco', editor: editor, container: container };
    });
  }
}

function labSetEditorCode(pane, code) {
  labEnsureEditor(pane);
  var holder = labEditors[pane];
  if (!holder) return;
  if (holder.mode === 'monaco') {
    if (holder.editor.getValue() !== code) holder.editor.setValue(code);
  } else {
    holder.editor.value = code;
    labPositionTextareaHighlight(pane, holder.highlightLines || []);
  }
}

function labGetCode(pane) {
  var holder = labEditors[pane];
  if (holder && holder.mode === 'monaco') return holder.editor.getValue();
  if (holder && holder.mode === 'textarea') return holder.editor.value;
  var state = labState[pane];
  return state ? state.code : '';
}

function labClearDecorations(pane) {
  var holder = labEditors[pane];
  if (holder && holder.mode === 'monaco' && holder.decorations) {
    holder.decorations.clear();
  }
  if (holder && holder.mode === 'textarea') {
    holder.highlightLines = [];
    labPositionTextareaHighlight(pane, []);
  }
}

// Mobile/narrow screens have no Monaco, so the executing line is shown as a
// highlight strip layered behind the plain-textarea editor: the text stays
// fully visible and editable, the strip tracks the active // @step lines.
function labPositionTextareaHighlight(pane, lines) {
  var holder = labEditors[pane];
  if (!holder || holder.mode !== 'textarea' || !holder.highlightEl || !holder.editor) return;
  holder.highlightLines = lines;
  var area = holder.editor;
  var style = window.getComputedStyle(area);
  var lineHeight = parseFloat(style.lineHeight);
  if (!isFinite(lineHeight) || lineHeight <= 0) lineHeight = 19.5;
  var padTop = parseFloat(style.paddingTop) || 0;
  var scrollTop = area.scrollTop;
  // Follow the trace like Monaco's reveal: scroll the active line into view
  // only when it is outside the visible part (manual scrolling is kept).
  if (lines.length > 0 && area.clientHeight > 0) {
    var lineTop = padTop + (lines[0] - 1) * lineHeight;
    if (lineTop < scrollTop || lineTop + lineHeight > scrollTop + area.clientHeight) {
      scrollTop = Math.max(0, lineTop - area.clientHeight / 2);
      area.scrollTop = scrollTop;
    }
  }
  holder.highlightEl.textContent = '';
  for (var i = 0; i < lines.length; i++) {
    if (lines[i] < 1) continue;
    var strip = document.createElement('div');
    strip.className = 'lab-code-highlight-line';
    strip.style.top = (padTop + (lines[i] - 1) * lineHeight - scrollTop) + 'px';
    strip.style.height = lineHeight + 'px';
    holder.highlightEl.appendChild(strip);
  }
}

function labUpdateDecorations(pane, snapshot) {
  var holder = labEditors[pane];
  if (!holder) return;
  var state = labState[pane];
  var step = snapshot.currentStep;
  var lines = (step && state.annotations.map[step]) || [];
  if (holder.mode === 'textarea') {
    labPositionTextareaHighlight(pane, lines);
    return;
  }
  if (holder.mode !== 'monaco') return;
  var decorations = [];
  for (var i = 0; i < lines.length; i++) {
    decorations.push({
      range: new window.monaco.Range(lines[i], 1, lines[i], 1),
      options: { isWholeLine: true, className: 'lab-step-line' },
    });
  }
  if (holder.decorations) {
    holder.decorations.set(decorations);
  } else if (holder.editor.createDecorationsCollection) {
    holder.decorations = holder.editor.createDecorationsCollection(decorations);
  } else if (holder.editor.deltaDecorations) {
    holder.decorations = {
      set: function (next) { holder.editor.deltaDecorations([], next); },
      clear: function () { holder.editor.deltaDecorations([], []); },
    };
  }
  if (lines.length > 0 && holder.editor.revealLineInCenterIfOutsideViewport) {
    holder.editor.revealLineInCenterIfOutsideViewport(lines[0]);
  }
}

// ---------------------------------------------------------------------------
// Canvas drawing
// ---------------------------------------------------------------------------

function labCanvas(pane) {
  return document.getElementById('labCanvas' + pane);
}

function labResizeCanvas(pane) {
  var canvas = labCanvas(pane);
  if (!canvas) return null;
  var rect = canvas.parentElement.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  var width = Math.max(120, Math.floor(rect.width));
  var height = Math.max(90, Math.floor(rect.height));
  if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
  }
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  var ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx: ctx, width: width, height: height };
}

function labResizeCanvases() {
  ['A', 'B'].forEach(function (pane) {
    if (pane === 'B' && !labCompare) return;
    labDraw(pane);
  });
}

function labDraw(pane, now) {
  var state = labState[pane];
  var canvas = labCanvas(pane);
  if (!state || !canvas || !state.renderer) return;
  var sized = labResizeCanvas(pane);
  if (!sized) return;
  var stamp = typeof now === 'number' ? now
    : (window.performance && performance.now ? performance.now() : Date.now());
  var ctx = sized.ctx;
  ctx.clearRect(0, 0, sized.width, sized.height);
  state.renderer.draw(ctx, sized.width, sized.height, labColors(), stamp);
}

function labDrawEmpty(pane) {
  var canvas = labCanvas(pane);
  if (!canvas) return;
  var sized = labResizeCanvas(pane);
  if (!sized) return;
  sized.ctx.clearRect(0, 0, sized.width, sized.height);
  var colors = labColors();
  sized.ctx.fillStyle = colors.low;
  sized.ctx.font = '13px -apple-system, Segoe UI, Helvetica, Arial, sans-serif';
  sized.ctx.textAlign = 'center';
  sized.ctx.textBaseline = 'middle';
  sized.ctx.fillText('Loading...', sized.width / 2, sized.height / 2);
}

function labRedrawAll() {
  labDraw('A');
  if (labCompare) labDraw('B');
}

// ---------------------------------------------------------------------------
// Frame loop (one shared clock feeds both panes)
// ---------------------------------------------------------------------------

function labStartLoop() {
  if (labRafId != null) return;
  var step = function (ts) {
    labRafId = window.requestAnimationFrame(step);
    ['A', 'B'].forEach(function (pane) {
      var state = labState[pane];
      if (!state) return;
      if (pane === 'B' && !labCompare) return;
      if (state.player) state.player.tick(ts);
      // Transitions keep drawing on their own between trace events.
      if (state.renderer && state.renderer.isAnimating(ts)) labDraw(pane, ts);
    });
    labUpdatePlayButton();
  };
  labRafId = window.requestAnimationFrame(step);
}

function labStopLoop() {
  if (labRafId != null) {
    window.cancelAnimationFrame(labRafId);
    labRafId = null;
  }
}

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

document.addEventListener('keydown', function (e) {
  var screen = document.getElementById('labScreen');
  if (!screen || screen.classList.contains('hidden')) return;
  var target = e.target;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    labToggle();
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    labStepFwd();
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    labStepBack();
  } else if (e.key === 'r' || e.key === 'R') {
    labReset();
  } else if (e.key === 'Escape') {
    window.showLanding();
  }
});

window.addEventListener('resize', function () {
  var screen = document.getElementById('labScreen');
  if (!screen || screen.classList.contains('hidden')) return;
  labEnsureEditor('A');
  if (labCompare) labEnsureEditor('B');
  labInvalidateTheme();
});

window.openLab = openLab;
window.labLeave = labStopLoop;
window.labSelectPreset = labSelectPreset;
window.labRun = labRun;
window.labToggle = labToggle;
window.labStepFwd = labStepFwd;
window.labStepBack = labStepBack;
window.labReset = labReset;
window.labSetSpeed = labSetSpeed;
window.labSeek = labSeek;
window.labToggleCompare = labToggleCompare;
window.labToggleCode = labToggleCode;
window.labOnThemeChange = labInvalidateTheme;
