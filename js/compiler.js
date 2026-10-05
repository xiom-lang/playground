// Copyright (c) 2026 Eleftherios Notas and The XIOM Authors
// SPDX-License-Identifier: MIT OR Apache-2.0
// Compile pipeline bridge.
//
// The server toolchain is authoritative (it is newer than the bundled WASM).
// The in-browser compiler is used for an instant IR preview and as an offline
// fallback for diagnostics; the server response overwrites both when it lands.
//
// Program input (1.1.0): the optional stdin textarea next to the Output tabs
// is piped to the program on Run (io.read_line/read_int/read_float).
var XIOM_STDIN_KEY = 'xiom_stdin';

function readStdinValue() {
  var el = document.getElementById('stdinInput');
  return el ? el.value : '';
}

function setStdinValue(value) {
  var el = document.getElementById('stdinInput');
  if (!el) return;
  el.value = value || '';
  try { localStorage.setItem(XIOM_STDIN_KEY, el.value); } catch (e) { /* private mode */ }
}

function prefillStdinSample(sample) {
  var el = document.getElementById('stdinInput');
  if (!el || !sample) return;
  // Lesson sample input fills the empty box; typed input always wins.
  if (el.value === '') setStdinValue(sample);
}

function showStdinRow() {
  var row = document.getElementById('stdinRow');
  var toggle = document.getElementById('stdinToggle');
  if (!row) return;
  row.classList.remove('hidden');
  if (toggle) {
    toggle.classList.add('active');
    toggle.classList.add('attention');
  }
}

function hideStdinRow() {
  var row = document.getElementById('stdinRow');
  var toggle = document.getElementById('stdinToggle');
  if (!row) return;
  row.classList.add('hidden');
  if (toggle) toggle.classList.remove('active');
}

// Lessons that read stdin get the Input box opened for them (with the shipped
// sample prefilled), so learners see where input comes from instead of having
// to discover the tab. Switching to a lesson that does not read input closes
// it again, but only when the box was auto-opened.
var stdinAutoOpened = false;
function lessonReadsInput(lesson) {
  if (!lesson) return false;
  var source = (lesson.solution || '') + '\n' + (lesson.code_template || '');
  return /io\.(read_line|read_int|read_float)\s*\(/.test(source);
}

function setupStdinForLesson(lesson) {
  var reads = lessonReadsInput(lesson);
  if (lesson && lesson.sample_input != null) {
    // Keep the raw Input tab primed with the sample; the conversation is the
    // main surface for input lessons, so the stdin row stays closed.
    setStdinValue(lesson.sample_input);
  }
  if (!reads && stdinAutoOpened) {
    hideStdinRow();
    stdinAutoOpened = false;
  }
  conversationSourceReads = reads;
  conversationApplyVisibility(reads);
  conversationGen += 1;
  conversationQueue = Promise.resolve();
  conversationRunCount = null;
  liveReset();
  conversationState = { answers: [], outputs: [], running: false, live: false, liveStarting: false, liveSent: 0, liveEntries: [], liveFailed: false };
  conversationRender();
}

function toggleStdin() {
  var row = document.getElementById('stdinRow');
  var toggle = document.getElementById('stdinToggle');
  if (!row) return;
  row.classList.toggle('hidden');
  stdinAutoOpened = false;
  var shown = !row.classList.contains('hidden');
  if (toggle) {
    toggle.classList.toggle('active', shown);
    toggle.classList.remove('attention');
  }
  // The raw input box and the conversation are alternatives, never stacked.
  conversationSetVisible(conversationActive() && !shown);
  var el = document.getElementById('stdinInput');
  if (shown && el) el.focus();
  else {
    var conv = document.getElementById('conversationInput');
    if (conv && conversationActive() && !conv.disabled) conv.focus();
  }
}

function clearStdin() {
  setStdinValue('');
}

// ---------------------------------------------------------------------------
// Conversation view (input lessons): the program's output and the learner's
// answers interleaved like a chat. Each answer re-runs the program with one
// more input line; the transcript builder keeps the dialogue in order.
// ---------------------------------------------------------------------------

var conversationState = { answers: [], outputs: [], running: false, live: false, liveStarting: false, liveSent: 0, liveEntries: [], liveFailed: false };
var conversationRunCount = null;
var conversationRunGen = 0;
var conversationGen = 0;
var conversationQueue = Promise.resolve();
var liveSession = null;
var conversationSourceReads = false;
var conversationLastSource = null;

// The Terminal is driven by what the program actually reads: the lesson's
// own source, or whatever the learner typed in the editor.
function conversationApplyVisibility(reads) {
  conversationSetVisible(!!reads);
  var outputTab = document.querySelector('.output-tabs .tab[data-tab="output"]');
  if (outputTab) outputTab.textContent = reads ? 'Terminal' : 'Output';
}

function conversationSourceCheck(source) {
  var text = String(source == null ? '' : source);
  var reads = /io\.(read_line|read_int|read_float)\s*\(/.test(text);
  var changed = conversationLastSource != null && text !== conversationLastSource;
  conversationLastSource = text;
  conversationSourceReads = reads;
  if (changed) {
    // New program: the old dialogue no longer applies.
    liveReset();
    conversationQueue = Promise.resolve();
    conversationRunCount = null;
    conversationGen += 1;
    conversationState = { answers: [], outputs: [], running: false, live: false, liveStarting: false, liveSent: 0, liveEntries: [], liveFailed: false };
    setStdinValue('');
  }
  var lesson = window.currentLessonData || null;
  var lessonReads = !!(lesson && typeof lessonReadsInput === 'function' && lessonReadsInput(lesson));
  conversationApplyVisibility(reads || lessonReads);
  conversationRender();
}

function conversationCompile(count) {
  conversationRunCount = count;
  conversationRunGen = conversationGen;
  return compile();
}

function liveReset() {
  if (liveSession && liveSession.id) {
    fetch('/api/live/close', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: liveSession.id }),
    }).catch(function () { /* best effort */ });
  }
  liveSession = null;
}

// The program finished (or the session died) but the learner kept answering:
// start a fresh live session and replay the whole answer history, exactly
// like the replay path does, so the terminal never stalls on "running...".
function liveRestartWithHistory() {
  liveReset();
  conversationState.live = false;
  conversationState.liveStarting = true;
  var ed = window.editor;
  var source = ed ? ed.getValue() : (window.getMobileCodeValue ? window.getMobileCodeValue() : '');
  liveStart(source);
}

function liveAppendText(text) {
  var entries = conversationState.liveEntries;
  var parts = String(text).split('\n');
  for (var i = 0; i < parts.length; i++) {
    if (i === 0 && entries.length > 0 && entries[entries.length - 1].kind === 'out') {
      entries[entries.length - 1].text += parts[i];
    } else {
      entries.push({ kind: 'out', text: parts[i] });
    }
  }
  // Drop a single trailing blank produced by a trailing newline.
  if (entries.length > 0 && entries[entries.length - 1].kind === 'out' && entries[entries.length - 1].text === '' && parts.length > 1) {
    entries.pop();
  }
}

function livePoll() {
  if (!liveSession || liveSession.polling) return;
  liveSession.polling = true;
  var tick = function () {
    var session = liveSession;
    if (!session) return;
    fetch('/api/live/output?id=' + encodeURIComponent(session.id) + '&after=' + session.after)
      .then(function (r) { return r.json(); })
      .then(function (payload) {
        if (!liveSession || liveSession !== session) return;
        if (payload.text) {
          liveAppendText(payload.text);
          conversationState.running = false;
        }
        session.after = payload.length;
        if (payload.exited) {
          session.exited = true;
          conversationState.running = false;
          conversationRender();
          var input = document.getElementById('conversationInput');
          if (input) {
            input.disabled = false;
            input.focus();
          }
          return;
        }
        tick();
      })
      .catch(function () {
        if (!liveSession || liveSession !== session) return;
        setTimeout(tick, 500);
      });
  };
  tick();
}

// Start a live session for the current program; fall back to replay when the
// server refuses (offline, limits) so the terminal always works.
function liveStart(source) {
  fetch('/api/live/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: source }),
  })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (payload) {
      if (!payload || !payload.id) throw new Error('live unavailable');
      liveSession = { id: payload.id, after: 0 };
      conversationState.live = true;
      conversationState.liveStarting = false;
      // Flush every answer so far, in order (covers fast successive submits).
      var lines = conversationState.answers.slice();
      var chain = Promise.resolve();
      for (var i = 0; i < lines.length; i++) {
        chain = chain.then((function (line) {
          return function () {
            return fetch('/api/live/input', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: liveSession.id, line: line }),
            });
          };
        })(lines[i]));
      }
      return chain.then(function () {
        conversationState.liveSent = lines.length;
        conversationRender();
        var field = document.getElementById('conversationInput');
        if (field) {
          field.disabled = false;
          field.focus();
        }
        livePoll();
      });
    })
    .catch(function () {
      // Replay path: queue the run with the accumulated answers.
      conversationState.liveFailed = true;
      conversationState.liveStarting = false;
      var input = document.getElementById('conversationInput');
      if (input) {
        input.disabled = true;
        conversationState.running = true;
      }
      conversationRender();
      conversationQueue = conversationQueue.then(function () {
        if (conversationState.outputs[0] == null) {
          setStdinValue('');
          return conversationCompile(0).then(function () {
            conversationSetStdin();
            return conversationCompile(conversationState.answers.length);
          });
        }
        conversationSetStdin();
        return conversationCompile(conversationState.answers.length);
      }).catch(function () {
        var el = document.getElementById('conversationInput');
        if (el) el.disabled = false;
      });
    });
}

function conversationActive() {
  if (conversationSourceReads) return true;
  var lesson = window.currentLessonData || null;
  return !!(lesson && typeof lessonReadsInput === 'function' && lessonReadsInput(lesson));
}

function conversationReset() {
  liveReset();
  conversationState = { answers: [], outputs: [], running: false, live: false, liveStarting: false, liveSent: 0, liveEntries: [], liveFailed: false };
  conversationRender();
}

function conversationSetStdin() {
  var text = conversationState.answers.length ? conversationState.answers.join('\n') + '\n' : '';
  setStdinValue(text);
}

function conversationRender() {
  var host = document.getElementById('conversationLog');
  if (!host) return;
  var builder = window.XiomConversation;
  var entries = conversationState.live
    ? conversationState.liveEntries.slice()
    : (builder ? builder.build(conversationState.outputs, conversationState.answers) : []);
  host.textContent = '';
  for (var i = 0; i < entries.length; i++) {
    var line = document.createElement('div');
    line.className = 'conversation-line ' + entries[i].kind;
    line.textContent = entries[i].text;
    host.appendChild(line);
  }
  if (conversationState.running) {
    var pending = document.createElement('div');
    pending.className = 'conversation-line pending';
    pending.textContent = 'running\u2026';
    host.appendChild(pending);
  }
  var hint = document.getElementById('conversationHint');
  var input = document.getElementById('conversationInput');
  if (input) {
    // A terminal has no placeholder: the program's last line is already in
    // the scrollback and the '>' prompt marks where typing happens.
    input.disabled = false;
    input.placeholder = '';
  }
  if (hint) {
    var mode = conversationState.live ? 'live' : (conversationState.liveFailed ? 'replay' : '');
    var base = conversationState.running
      ? 'Running the program with your answer\u2026'
      : (conversationState.live
        ? 'Live session: type your answer at the > prompt and press Enter.'
        : (conversationState.answers.length === 0
          ? 'Type an answer and press Enter; the program runs with your input.'
          : 'Answer ' + (conversationState.answers.length + 1) + ' - each answer re-runs the program with it.'));
    hint.textContent = base + (mode === 'replay' ? ' (replay mode: the sandbox here cannot stream stdin)' : '');
  }
  host.scrollTop = host.scrollHeight;
}

function conversationOnRun(run) {
  if (!conversationActive()) return;
  conversationState.running = false;
  var count = conversationRunCount == null ? conversationState.answers.length : conversationRunCount;
  var stale = conversationRunCount != null && conversationRunGen !== conversationGen;
  conversationRunCount = null;
  if (!stale) {
    var output = run.runOutput != null ? run.runOutput : String(run.output || '');
    conversationState.outputs[count] = output;
  }
  conversationRender();
  var input = document.getElementById('conversationInput');
  if (input) {
    input.disabled = false;
    input.focus();
  }
}

function conversationSubmit(event) {
  if (event && event.preventDefault) event.preventDefault();
  if (!conversationActive()) return false;
  var input = document.getElementById('conversationInput');
  if (!input || input.disabled) return false;
  var line = input.value.replace(/[\r\n]+/g, ' ').trim();
  if (!line) return false;
  conversationState.answers.push(line);
  input.value = '';
  input.disabled = true;
  conversationState.running = true;
  if (window.resetOutputMatch) window.resetOutputMatch();
  if (conversationState.live) {
    conversationState.liveEntries.push({ kind: 'you', text: line });
    conversationRender();
    // Send only when the session is alive and every earlier answer was sent;
    // answers queued while the session started are flushed by liveStart.
    // When the program has already finished, restart with the full history
    // instead of leaving the answer stranded behind "running...".
    if (liveSession && !liveSession.exited && conversationState.liveSent === conversationState.answers.length - 1) {
      conversationState.liveSent = conversationState.answers.length;
      fetch('/api/live/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: liveSession.id, line: line }),
      }).catch(function () { /* the poll will surface the exit */ });
      input.disabled = false;
      input.focus();
    } else if (!liveSession || liveSession.exited) {
      liveRestartWithHistory();
    } else {
      // Defensive: never leave the terminal unable to accept input.
      input.disabled = false;
      input.focus();
    }
    return false;
  }
  if (conversationState.liveStarting) {
    conversationState.liveEntries.push({ kind: 'you', text: line });
    conversationRender();
    return false;
  }
  if (!conversationState.liveFailed) {
    // First answer tries a live session; the terminal falls back to replay.
    conversationState.liveStarting = true;
    conversationState.liveEntries.push({ kind: 'you', text: line });
    conversationRender();
    var ed = window.editor;
    var liveSource = ed ? ed.getValue() : (window.getMobileCodeValue ? window.getMobileCodeValue() : '');
    liveStart(liveSource);
    return false;
  }
  conversationRender();
  // Serialize runs: each answer compiles from the answers snapshot taken when
  // its turn comes, so fast typing cannot mis-key the transcript outputs.
  conversationQueue = conversationQueue.then(function () {
    if (conversationState.outputs[0] == null) {
      setStdinValue('');
      return conversationCompile(0).then(function () {
        conversationSetStdin();
        return conversationCompile(conversationState.answers.length);
      });
    }
    conversationSetStdin();
    return conversationCompile(conversationState.answers.length);
  }).catch(function () {
    var el = document.getElementById('conversationInput');
    if (el) el.disabled = false;
  });
  return false;
}

function conversationRestart() {
  conversationQueue = Promise.resolve();
  conversationRunCount = null;
  liveReset();
  conversationState = { answers: [], outputs: [], running: false, live: false, liveStarting: false, liveSent: 0, liveEntries: [], liveFailed: false };
  setStdinValue('');
  conversationRender();
  var input = document.getElementById('conversationInput');
  if (input) {
    input.disabled = false;
    input.focus();
  }
}

function conversationSetVisible(visible) {
  var panel = document.getElementById('conversation');
  if (panel) panel.classList.toggle('hidden', !visible);
  var outputPanel = document.querySelector('.output-panel');
  if (outputPanel) outputPanel.classList.toggle('conversation-active', !!visible);
}

/** Tab changes: the conversation belongs to the Output tab only. */
function conversationTabChanged(tabName) {
  var stdinRow = document.getElementById('stdinRow');
  var stdinShown = stdinRow && !stdinRow.classList.contains('hidden');
  conversationSetVisible(conversationActive() && tabName === 'output' && !stdinShown);
}

document.addEventListener('DOMContentLoaded', function () {
  try {
    var saved = localStorage.getItem(XIOM_STDIN_KEY);
    if (saved) setStdinValue(saved);
  } catch (e) { /* private mode */ }
  var stdinEl = document.getElementById('stdinInput');
  if (stdinEl) {
    stdinEl.addEventListener('input', function () {
      if (window.resetOutputMatch) window.resetOutputMatch();
    });
  }
});

async function compile() {
  var screen = document.getElementById('lessonsScreen');
  if (!screen || screen.classList.contains('hidden')) return;

  var ed = window.editor;
  var source = ed ? ed.getValue() : (window.getMobileCodeValue ? window.getMobileCodeValue() : '');
  var ids = { output: 'output', ir: 'ir', diag: 'diag', tokens: 'tokens', contracts: 'contracts', status: 'status' };
  var statusEl = document.getElementById(ids.status);
  var btn = document.getElementById('btnRun');

  if (btn) btn.classList.add('running');
  if (window.startCompileClock) window.startCompileClock('Compiling...');
  else statusEl.textContent = 'Compiling...';
  statusEl.className = 'status-bar busy';
  statusEl.style.display = '';
  var statusSettled = false;
  window._lastSource = source;
  conversationSourceCheck(source);

  if (window.isCurrentLessonLimited && window.isCurrentLessonLimited()) {
    if (window.stopCompileClock) window.stopCompileClock();
    statusSettled = true;
    statusEl.textContent = 'This lesson is blocked by a known compiler bug; see the notice above.';
    statusEl.className = 'status-bar err';
    if (btn) btn.classList.remove('running');
    return;
  }

  var payload = { source: source };
  var stdinValue = readStdinValue();
  if (stdinValue) payload.stdin = stdinValue;
  var body = JSON.stringify(payload);
  var headers = { 'Content-Type': 'application/json' };

  resetOutputMatch();

  // 1. In-browser compiler: instant IR preview / offline diagnostics.
  var wasmResult = null;
  var pureProgram = source.indexOf('use ') === -1 && source.indexOf('use\t') === -1;
  if (window.xiomWasm && pureProgram) {
    try {
      var wasm = await window.xiomWasm;
      if (wasm) wasmResult = JSON.parse(wasm.compile(source));
    } catch (e) {
      console.warn('[xiom-wasm] compile failed, using server only: ' + e);
    }
  }
  if (wasmResult) renderWasmPreview(wasmResult, ids);

  // 2. Server type check (authoritative) and run happen in parallel.
  var serverReachable = null;
  var checkPromise = fetch('/api/check', { method: 'POST', headers: headers, body: body })
    .then(function (r) { return r.json(); })
    .then(function (check) {
      serverReachable = true;
      renderDiagnostics(check.diagnostics || [], !!check.success, ids, false);
    })
    .catch(function () {
      serverReachable = false;
      if (wasmResult) {
        renderDiagnostics(wasmResult.diagnostics || [], !!wasmResult.success, ids, true);
      }
    });

  var runPromise = fetch('/api/compile', { method: 'POST', headers: headers, body: body })
    .then(function (r) { return r.json(); })
    .then(function (run) {
      renderRunResult(run, ids);
      conversationOnRun(run);
      if (window.recordRun && window.currentLessonId) {
        window.recordRun(window.currentLessonId, run);
        if (window.renderHistoryBlock) window.renderHistoryBlock(window.currentLessonId);
      }
      if (window.stopCompileClock) window.stopCompileClock();
      statusSettled = true;
      if (run.success) {
        statusEl.innerHTML = '[OK] Ran in ' + ((run.elapsedMs || 0) / 1000).toFixed(1) + 's';
        statusEl.className = 'status-bar ok';
      } else if (run.timedOut) {
        statusEl.textContent = 'Timed out. Try a smaller program.';
        statusEl.className = 'status-bar err';
      } else {
        statusEl.innerHTML = '[FAIL] Failed';
        statusEl.className = 'status-bar err';
      }
    })
    .catch(function () {
      if (!statusSettled) {
        if (window.stopCompileClock) window.stopCompileClock();
        statusSettled = true;
        statusEl.textContent = serverReachable === false && wasmResult
          ? 'Offline: in-browser diagnostics only. Output needs the server.'
          : 'Server not running.';
        statusEl.className = 'status-bar err';
      }
    });

  await Promise.all([checkPromise, runPromise]);
  if (btn) btn.classList.remove('running');
}

function renderWasmPreview(res, ids) {
  var irEl = document.getElementById(ids.ir);
  if (irEl && res.ir) {
    irEl.textContent = res.ir;
    irEl.classList.add('animate-in');
    window._lastWasmIr = res.ir;
  }
  if (!res.success && !document.getElementById(ids.output).textContent) {
    document.getElementById(ids.output).textContent = 'Compilation failed - see Diagnostics tab.';
  }
}

function renderDiagnostics(diags, success, ids, fromWasm) {
  var diagEl = document.getElementById(ids.diag);
  if (!diagEl) return;
  var isError = function (d) {
    var kind = d.kind || '';
    return kind === 'error' || kind === 'type_error' || kind === 'parse_error' || kind === 'lex_error' || (d.code || '').charAt(0) === 'E' || (d.code || '').charAt(0) === 'P' || (d.code || '').charAt(0) === 'T';
  };
  if (diags.length > 0) {
    diagEl.innerHTML = diags.map(function (d) {
      return '<div class="diag-item ' + (isError(d) ? 'diag-error' : 'diag-warn') + '">[' + d.code + '] line ' + d.line + ':' + d.col + ' - ' + escapeHtml(d.message) + '</div>';
    }).join('');
  } else if (success) {
    diagEl.innerHTML = '<span style="color:#34d399">No diagnostics - clean code. [OK]' + (fromWasm ? ' (WASM)' : '') + '</span>';
  }
  if (window.editor && window.monaco) {
    monaco.editor.setModelMarkers(window.editor.getModel(), 'xiom', diags.filter(function (d) { return d.line > 0; }).map(function (d) {
      return {
        severity: isError(d) ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        message: d.message,
        startLineNumber: d.line,
        startColumn: d.col || 1,
        endLineNumber: d.line,
        endColumn: (d.col || 1) + 15,
      };
    }));
  }
}

function renderRunResult(run, ids) {
  var outputEl = document.getElementById(ids.output);
  outputEl.textContent = run.output || 'No output.';
  outputEl.classList.add('animate-in');

  if (run.ir) {
    document.getElementById(ids.ir).textContent = run.ir;
  } else if (!window._lastWasmIr) {
    document.getElementById(ids.ir).textContent = 'Click this tab to generate IR.';
  } else {
    document.getElementById(ids.ir).textContent = window._lastWasmIr;
  }
  if (run.contracts) {
    document.getElementById(ids.contracts).textContent =
      'Runtime-checked when the program runs: contract guards abort with a structured diagnostic if a promise is broken.\n\n' +
      'Verification export (experimental, SMT-LIB; not a proof):\n\n' + run.contracts;
  } else {
    document.getElementById(ids.contracts).textContent =
      'This program has no contracts. Contracts are runtime-checked when present; the SMT-LIB verification export is experimental.';
  }
  if (!run.tokens) {
    document.getElementById(ids.tokens).textContent = 'Click this tab to generate tokens.';
  }
  renderOutputMatch(run);
}

// Canonical output form; keep in sync with tools/lib/output.js.
function normalizeOutputText(text) {
  return String(text == null ? '' : text)
    .replace(/\r\n/g, '\n')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n+$/, '');
}

function outputMatchHost() {
  var pre = document.getElementById('output');
  if (!pre || !pre.parentNode) return null;
  var host = document.getElementById('outputMatch');
  if (!host) {
    host = document.createElement('div');
    host.id = 'outputMatch';
    host.className = 'output-match hidden';
    pre.parentNode.insertBefore(host, pre);
  }
  return host;
}

function resetOutputMatch() {
  var host = document.getElementById('outputMatch');
  if (host) {
    host.className = 'output-match hidden';
    host.innerHTML = '';
  }
}

/**
 * Compare the run output with the lesson's generated expected_output.
 * The comparison only applies when the editor still holds the reference
 * solution; for edited programs it just says so, because a different output
 * is the point of experimenting.
 */
function renderOutputMatch(run) {
  var host = outputMatchHost();
  if (!host) return;
  host.className = 'output-match hidden';
  host.innerHTML = '';

  var lesson = window.currentLessonData || (typeof currentLessonData !== 'undefined' ? currentLessonData : null);
  if (!lesson || typeof lesson.expected_output !== 'string') return;
  if (!run || !run.success) return;

  var actual = run.runOutput != null ? run.runOutput : String(run.output || '');
  if (actual === 'Program ran with no output.') actual = '';
  var expected = lesson.expected_output;

  // Input lessons: the expected output was generated from the shipped sample.
  // Running with the learner's own input is the point, so do not call it a
  // mismatch.
  var sample = lesson.sample_input == null ? '' : lesson.sample_input;
  if (typeof lessonReadsInput === 'function' && lessonReadsInput(lesson) && readStdinValue() !== sample) {
    host.className = 'output-match note';
    host.textContent = 'Running with your own input \u2014 the expected-output check compares against the sample input.';
    return;
  }

  var source = window.editor ? window.editor.getValue() : (window.getMobileCodeValue ? window.getMobileCodeValue() : '');
  var sourceMatches = typeof lesson.solution === 'string' &&
    normalizeOutputText(source) === normalizeOutputText(lesson.solution);
  if (!sourceMatches) {
    host.className = 'output-match note';
    host.textContent = 'Edited program \u2014 not compared with the lesson\'s expected output.';
    return;
  }

  if (normalizeOutputText(actual) === normalizeOutputText(expected)) {
    host.className = 'output-match ok';
    host.textContent = '\u2713 Output matches the expected result.';
    return;
  }

  host.className = 'output-match warn';
  var title = document.createElement('div');
  title.className = 'output-match-title';
  title.textContent = 'Output differs from the expected result.';
  var detail = document.createElement('pre');
  detail.className = 'output-match-expected';
  detail.textContent = 'Expected:\n' + (expected.length > 2000 ? expected.slice(0, 2000) + '\n...' : expected);
  host.appendChild(title);
  host.appendChild(detail);
}
window.renderOutputMatch = renderOutputMatch;
window.resetOutputMatch = resetOutputMatch;

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightIR(ir) {
  return escapeHtml(ir)
    .replace(/\b(define|declare|ret|br|call|load|store|alloca|getelementptr|icmp|fcmp|add|sub|mul|sdiv|srem|zext|sext|bitcast|inttoptr|ptrtoint|unreachable|switch|phi|select|fadd|fsub|fmul|fdiv)\b/g, '<span style="color:#ff8fb3;font-weight:bold">$1</span>')
    .replace(/\b(i64|i32|i8|i16|double|float|void|i1|%struct\\.\\w+)\b/g, '<span style="color:#7fd6c0">$1</span>')
    .replace(/\b(\d+)\b/g, '<span style="color:#e8c37a">$1</span>')
    .replace(/(%\\w+)/g, '<span style="color:#8fb3ff">$1</span>')
    .replace(/(@\\w+)/g, '<span style="color:#e8c37a">$1</span>');
}

function updateTabBadgesAlt(diags, tokens, contracts, source) {
  document.querySelectorAll('.output-tabs .tab .tab-badge').forEach(function (b) { b.remove(); });
  function badge(el, n) {
    if (!el || !n) return;
    var b = document.createElement('span');
    b.className = 'tab-badge';
    b.textContent = n;
    el.appendChild(b);
  }
  document.querySelectorAll('.output-tabs .tab').forEach(function (t) {
    var dt = t.dataset.tab;
    if (dt === 'diag') badge(t, diags.filter(function (d) { return d.kind === 'error'; }).length);
    if (dt === 'contracts' && (source.indexOf('requires:') >= 0 || source.indexOf('ensures:') >= 0)) badge(t, 1);
    if (dt === 'tokens' && tokens) badge(t, tokens.length);
  });
}

function lazyLoadTab(tabName) {
  var source = window._lastSource;
  if (!source) return;
  var el = document.getElementById(tabName === 'ir' ? 'ir' : 'tokens');
  if (!el) return;
  el.textContent = 'Generating...';
  fetch('/api/' + (tabName === 'ir' ? 'ir' : 'tokens'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: source }),
  })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (data.success && data.output) {
        el.textContent = data.output;
      } else if (tabName === 'ir' && window._lastWasmIr) {
        el.textContent = window._lastWasmIr + '\n\n; (in-browser compiler output; server unavailable)';
      } else {
        el.textContent = data.error || 'Not available';
      }
    })
    .catch(function () {
      el.textContent = (tabName === 'ir' && window._lastWasmIr) ? window._lastWasmIr : 'Cannot reach server.';
    });
}

window.lazyLoadTab = lazyLoadTab;
