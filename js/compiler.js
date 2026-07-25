async function compile() {
  var lessonsScreen = document.getElementById('lessonsScreen');
  if (!lessonsScreen || lessonsScreen.classList.contains('hidden')) return;

  var ed = window.editor;
  var source = ed ? ed.getValue() : '';
  var ids = { output: 'output', ir: 'ir', diag: 'diag', tokens: 'tokens', contracts: 'contracts', status: 'status' };
  var statusEl = document.getElementById(ids.status);

  statusEl.textContent = 'Compiling...';
  statusEl.className = 'status-bar busy';

  try {
    var body = JSON.stringify({ source: source });
    var headers = { 'Content-Type': 'application/json' };

    var [checkResp, runResp] = await Promise.all([
      fetch('/api/check', { method: 'POST', headers: headers, body: body }),
      fetch('/api/compile', { method: 'POST', headers: headers, body: body })
    ]);

    var check = await checkResp.json();
    var run = await runResp.json();

    // Output
    var outputEl = document.getElementById(ids.output);
    outputEl.textContent = run.output || 'No output.';
    outputEl.classList.add('animate-in');

    // IR
    var irEl = document.getElementById(ids.ir);
    if (run.ir) {
      irEl.innerHTML = highlightIR(run.ir);
    } else {
      irEl.textContent = 'Click this tab to generate IR.';
    }

    // Diagnostics from check (fast path)
    var diagEl = document.getElementById(ids.diag);
    var diags = check.diagnostics || [];
    if (diags.length > 0) {
      diagEl.innerHTML = diags.map(function (d) {
        var cls = d.kind === 'error' ? 'diag-error' : 'diag-warn';
        return '<div class="diag-item ' + cls + '">[' + d.code + '] line ' + d.line + ':' + d.col + ' \u2014 ' + escapeHtml(d.message) + '</div>';
      }).join('');
    } else if (check.success) {
      diagEl.innerHTML = '<span style="color:#34d399">No diagnostics \u2014 clean code. \u2713;</span>';
    }

    // Contracts
    var contractsEl = document.getElementById(ids.contracts);
    if (run.contracts) {
      contractsEl.textContent = run.contracts;
    } else if (source.indexOf('requires:') >= 0 || source.indexOf('ensures:') >= 0) {
      contractsEl.innerHTML = '<span style="color:#f0b445">Contracts detected. Verification not run.</span>';
    } else {
      contractsEl.innerHTML = '<span style="color:#5c5f6b">No contracts in this code.</span>';
    }

    // Tokens — placeholder
    var tokensEl = document.getElementById(ids.tokens);
    if (!run.tokens) tokensEl.textContent = 'Click this tab to generate tokens.';

    // Status
    var errCount = diags.filter(function(d){return d.kind==='error'}).length;
    statusEl.innerHTML = run.success ? '&#x2713; Ran' : '&#x2717; ' + errCount + ' error(s)';
    statusEl.className = run.success ? 'status-bar ok' : (errCount ? 'status-bar err' : 'status-bar ok');

    // Badges
    updateTabBadgesAlt(diags, run.tokens, run.contracts, source);

    // Editor markers
    if (window.editor && window.monaco) {
      monaco.editor.setModelMarkers(window.editor.getModel(), 'xiom', diags.filter(function (d) { return d.line > 0; }).map(function (d) {
        return {
          severity: d.kind === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
          message: d.message,
          startLineNumber: d.line,
          startColumn: d.col || 1,
          endLineNumber: d.line,
          endColumn: (d.col || 1) + 15,
        };
      }));
    }

    // Store for lazy tabs
    window._lastSource = source;

  } catch (e) {
    var outEl = document.getElementById(ids.output);
    outEl.textContent = 'Cannot reach compile server. Run: node server.js';
    statusEl.textContent = 'Server not running.';
    statusEl.className = 'status-bar err';
  }

  if (window.hideLoading) window.hideLoading();
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
