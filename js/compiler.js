async function compile() {
  if (currentMode === 'landing' || !currentMode) return;

  var ed = getActiveEditor();
  var source = ed ? ed.getValue() : '';
  var ids = getActiveOutputIds();
  var statusEl = document.getElementById(ids.status);

  statusEl.textContent = 'Compiling...';
  statusEl.className = 'status-bar busy';

  // Show loading overlay
  if (window.showLoading) window.showLoading();

  try {
    var resp = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: source })
    });
    var r = await resp.json();

    var outputEl = document.getElementById(ids.output);
    var outText = r.output || 'No output.';
    if (r.runError) {
      outText += '\n\n--- stderr ---\n' + r.runError;
    }
    outputEl.textContent = outText;
    outputEl.classList.add('animate-in');

    var irEl = document.getElementById(ids.ir);
    if (r.ir) {
      irEl.innerHTML = highlightIR(r.ir);
    } else if (r.stages && r.stages.lex && r.stages.lex.success === false) {
      irEl.innerHTML = '<span style="color:#5c5f6b">Lexer errors prevented code generation. Fix the errors first.</span>';
    } else {
      irEl.innerHTML = '<span style="color:#5c5f6b">No IR generated. Code may have errors.</span>';
    }

    var diagEl = document.getElementById(ids.diag);
    if (r.diagnostics && r.diagnostics.length > 0) {
      diagEl.innerHTML = r.diagnostics.map(function (d) {
        var cls = d.kind === 'error' ? 'diag-error' : 'diag-warn';
        return '<div class="diag-item ' + cls + '"><b>[' + escapeHtml(d.code) + ']</b> line ' + d.line + ':' + d.col + ' — ' + escapeHtml(d.message) + '</div>';
      }).join('');
    } else if (r.success) {
      diagEl.innerHTML = '<span style="color:#34d399">No diagnostics — clean compilation. &#x2713;</span>';
    } else {
      diagEl.innerHTML = '<span style="color:#5c5f6b">No diagnostics available.</span>';
    }

    var tokensEl = document.getElementById(ids.tokens);
    if (r.tokens && r.tokens.length > 0) {
      tokensEl.innerHTML = r.tokens.map(function (t) { return '<span style="color:#5c5f6b">' + escapeHtml(t) + '</span>'; }).join('\n');
    } else {
      tokensEl.innerHTML = '<span style="color:#5c5f6b">Token stream not available. Run with --emit-tokens on the server.</span>';
    }

    var contractsEl = document.getElementById(ids.contracts);
    if (r.contracts) {
      contractsEl.textContent = r.contracts;
    } else if (source.indexOf('requires:') >= 0 || source.indexOf('ensures:') >= 0) {
      contractsEl.innerHTML = '<span style="color:#f0b445">Contracts detected but verification not run. Check server support.</span>';
    } else {
      contractsEl.innerHTML = '<span style="color:#5c5f6b">No contracts in this code. Add <code style="color:#5c6bff">requires:</code> or <code style="color:#5c6bff">ensures:</code> to see verification.</span>';
    }

    if (window.editor && window.monaco && currentMode === 'lessons') {
      monaco.editor.setModelMarkers(window.editor.getModel(), 'xiom', (r.diagnostics || []).filter(function (d) { return d.line > 0; }).map(function (d) {
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

    if (window.pgEditor && window.monaco && currentMode === 'playground') {
      monaco.editor.setModelMarkers(window.pgEditor.getModel(), 'xiom', (r.diagnostics || []).filter(function (d) { return d.line > 0; }).map(function (d) {
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

    var errCount = (r.diagnostics || []).filter(function (d) { return d.kind === 'error'; }).length;
    statusEl.innerHTML = r.success && r.runOutput !== undefined ? 'Ran successfully. &#x2713;' : (r.success ? 'Compiled successfully. &#x2713;' : 'Failed: ' + errCount + ' error(s)');
    statusEl.className = r.success ? 'status-bar ok' : (errCount ? 'status-bar err' : 'status-bar ok');
    if (window.hideLoading) window.hideLoading();

    // Update tab badge counts
    updateTabBadges(r, source);

  } catch (e) {
    var outEl = document.getElementById(ids.output);
    outEl.textContent = 'Cannot reach compile server. Run: node server.js';
    statusEl.textContent = 'Server not running.';
    statusEl.className = 'status-bar err';
    if (window.hideLoading) window.hideLoading();
  }
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

function updateTabBadges(r, source) {
  var tabs = document.querySelectorAll('.output-tabs .tab');
  tabs.forEach(function (tab) {
    // Remove existing badges
    var existing = tab.querySelector('.tab-badge');
    if (existing) existing.remove();
    tab.style.position = '';
  });

  function addBadge(tabEl, count) {
    if (!tabEl || count === 0) return;
    var badge = document.createElement('span');
    badge.className = 'tab-badge';
    badge.textContent = count;
    tabEl.style.position = 'relative';
    tabEl.appendChild(badge);
  }

  var prefix = !document.getElementById('lessonsScreen').classList.contains('hidden') ? '' : 'pg';
  var diagCount = (r.diagnostics || []).length;
  var contractCount = source.indexOf('requires:') >= 0 || source.indexOf('ensures:') >= 0 ? 1 : 0;
  var tokenCount = (r.tokens || []).length;

  tabs.forEach(function (tab) {
    var dt = tab.dataset.tab;
    if (dt === 'diag' && diagCount > 0) addBadge(tab, diagCount);
    if (dt === 'contracts' && contractCount > 0) addBadge(tab, contractCount);
    if (dt === 'tokens' && tokenCount > 0) addBadge(tab, tokenCount);
  });
}
