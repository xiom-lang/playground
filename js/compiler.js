// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
async function compile() {
  var screen = document.getElementById('lessonsScreen');
  if (!screen || screen.classList.contains('hidden')) return;

  var ed = window.editor;
  var source = ed ? ed.getValue() : '';
  var ids = { output: 'output', ir: 'ir', diag: 'diag', tokens: 'tokens', contracts: 'contracts', status: 'status' };
  var statusEl = document.getElementById(ids.status);
  var btn = document.getElementById('btnRun');

  // Show compiling state on button + status
  if (btn) btn.classList.add('running');
  statusEl.textContent = 'Compiling...';
  statusEl.className = 'status-bar busy';
  statusEl.style.display = '';

  var body = JSON.stringify({ source: source });
  var headers = { 'Content-Type': 'application/json' };

  // In-browser WASM compiler (if loaded): diagnostics + LLVM IR instantly for
  // PURE programs. Programs with `use` (stdlib imports) cannot compile in the
  // wasm (no stdlib bundled) -- those go entirely to the server. The server
  // /api/compile is still used to RUN the program (Output tab).
  var wasmCompiled = false;
  var wasmIrSet = false;
  var pureProgram = source.indexOf('use ') === -1;
  if (window.xiomWasm && pureProgram) {
    window.xiomWasm.then(function (w) {
      if (!w) return;
      try {
        var res = JSON.parse(w.compile(source));
        wasmCompiled = true;
        var diagEl = document.getElementById(ids.diag);
        if (diagEl) {
          var diags = res.diagnostics || [];
          if (diags.length > 0) {
            diagEl.innerHTML = diags.map(function (d) {
              var cls = d.kind === 'type_error' || d.kind === 'parse_error' || d.kind === 'lex_error' ? 'diag-error' : 'diag-warn';
              return '<div class="diag-item ' + cls + '">[' + d.code + '] line ' + d.line + ':' + d.col + ' -- ' + escapeHtml(d.message) + '</div>';
            }).join('');
          } else if (res.success) {
            diagEl.innerHTML = '<span style="color:#34d399">No diagnostics -- clean code. [OK] (WASM)</span>';
          }
          // Editor markers
          if (window.editor && window.monaco) {
            monaco.editor.setModelMarkers(window.editor.getModel(), 'xiom', diags.filter(function (d) { return d.line > 0; }).map(function (d) {
              return { severity: (d.kind === 'type_error' || d.kind === 'parse_error' || d.kind === 'lex_error') ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning, message: d.message, startLineNumber: d.line, startColumn: d.col || 1, endLineNumber: d.line, endColumn: (d.col || 1) + 15 };
            }));
          }
        }
        var irEl = document.getElementById(ids.ir);
        if (irEl && res.ir) {
          irEl.textContent = res.ir;
          wasmIrSet = true;
          irEl.classList.add('animate-in');
        }
        if (!res.success && !document.getElementById(ids.output).textContent) {
          document.getElementById(ids.output).textContent = 'Compilation failed -- see Diagnostics tab.';
        }
      } catch (e) {
        console.warn('[xiom-wasm] compile error, falling back to server: ' + e);
        wasmCompiled = false;
      }
    }).catch(function () {});
  }

  // Server /api/check: diagnostics fallback when the WASM compiler is absent.
  if (!wasmCompiled) {
    fetch('/api/check', { method: 'POST', headers: headers, body: body })
      .then(function (r) { return r.json(); })
      .then(function (check) {
        if (wasmCompiled) return;
        var diagEl = document.getElementById(ids.diag);
        var diags = check.diagnostics || [];
        if (diags.length > 0) {
          diagEl.innerHTML = diags.map(function (d) {
            var cls = d.kind === 'error' ? 'diag-error' : 'diag-warn';
            return '<div class="diag-item ' + cls + '">[' + d.code + '] line ' + d.line + ':' + d.col + ' -- ' + escapeHtml(d.message) + '</div>';
          }).join('');
        } else if (check.success) {
          diagEl.innerHTML = '<span style="color:#34d399">No diagnostics -- clean code. [OK]</span>';
        }
        // Editor markers
        if (window.editor && window.monaco) {
          monaco.editor.setModelMarkers(window.editor.getModel(), 'xiom', diags.filter(function (d) { return d.line > 0; }).map(function (d) {
            return { severity: d.kind === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning, message: d.message, startLineNumber: d.line, startColumn: d.col || 1, endLineNumber: d.line, endColumn: (d.col || 1) + 15 };
          }));
        }
        statusEl.textContent = 'Running...';
      }).catch(function () {});
  }

  fetch('/api/compile', { method: 'POST', headers: headers, body: body })
    .then(function(r) { return r.json(); })
    .then(function(run) {
      var outputEl = document.getElementById(ids.output);
      outputEl.textContent = run.output || 'No output.';
      outputEl.classList.add('animate-in');

      var irEl = document.getElementById(ids.ir);
      // Don't clobber the WASM-generated IR with the server's placeholder when
      // the server only returns run output.
      if (!wasmIrSet) {
        irEl.textContent = run.ir ? run.ir : 'Click this tab to generate IR.';
      }

      if (run.contracts) {
        document.getElementById(ids.contracts).textContent = run.contracts;
      }

      var tokensEl = document.getElementById(ids.tokens);
      if (!run.tokens) tokensEl.textContent = 'Click this tab to generate tokens.';

      statusEl.innerHTML = run.success ? '[OK] Ran' : '[FAIL] Failed';
      statusEl.className = run.success ? 'status-bar ok' : 'status-bar err';
      if (btn) btn.classList.remove('running');

      window._lastSource = source;
    }).catch(function(e) {
      statusEl.textContent = 'Server not running.';
      statusEl.className = 'status-bar err';
      if (btn) btn.classList.remove('running');
    });
}

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
  document.querySelectorAll('.output-tabs .tab .tab-badge').forEach(function(b){b.remove();});
  function badge(el, n) {
    if (!el || !n) return;
    var b = document.createElement('span'); b.className = 'tab-badge'; b.textContent = n;
    el.appendChild(b);
  }
  document.querySelectorAll('.output-tabs .tab').forEach(function(t) {
    var dt = t.dataset.tab;
    if (dt === 'diag') badge(t, diags.filter(function(d){return d.kind==='error'}).length);
    if (dt === 'contracts' && (source.indexOf('requires:')>=0||source.indexOf('ensures:')>=0)) badge(t, 1);
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
    body: JSON.stringify({ source: source })
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    el.textContent = data.success && data.output ? data.output : (data.error || 'Not available');
  })
  .catch(function() { el.textContent = 'Cannot reach server.'; });
}

window.lazyLoadTab = lazyLoadTab;
