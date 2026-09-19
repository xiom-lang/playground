// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
// Compile pipeline bridge.
//
// The server toolchain is authoritative (it is newer than the bundled WASM).
// The in-browser compiler is used for an instant IR preview and as an offline
// fallback for diagnostics; the server response overwrites both when it lands.
async function compile() {
  var screen = document.getElementById('lessonsScreen');
  if (!screen || screen.classList.contains('hidden')) return;

  var ed = window.editor;
  var source = ed ? ed.getValue() : (window.getMobileCodeValue ? window.getMobileCodeValue() : '');
  var ids = { output: 'output', ir: 'ir', diag: 'diag', tokens: 'tokens', contracts: 'contracts', status: 'status' };
  var statusEl = document.getElementById(ids.status);
  var btn = document.getElementById('btnRun');

  if (btn) btn.classList.add('running');
  statusEl.textContent = 'Compiling...';
  statusEl.className = 'status-bar busy';
  statusEl.style.display = '';
  window._lastSource = source;

  if (window.isCurrentLessonLimited && window.isCurrentLessonLimited()) {
    statusEl.textContent = 'This lesson is blocked by a known compiler bug; see the notice above.';
    statusEl.className = 'status-bar err';
    if (btn) btn.classList.remove('running');
    return;
  }

  var body = JSON.stringify({ source: source });
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
      if (window.recordRun && window.currentLessonId) {
        window.recordRun(window.currentLessonId, run);
        if (window.renderHistoryBlock) window.renderHistoryBlock(window.currentLessonId);
      }
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
      if (statusEl.textContent === 'Compiling...') {
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
