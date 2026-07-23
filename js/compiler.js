// XIOM Playground Compiler Bridge
// Multi-stage: tokens, parse, IR, diagnostics, contracts

async function compile() {
  const source = window.editor?.getValue() || document.getElementById('editor')?.value || '';
  const status = document.getElementById('status');
  status.textContent = 'Compiling...';
  status.className = 'status-bar busy';

  try {
    const resp = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source })
    });
    const r = await resp.json();

    // Output tab — human readable
    document.getElementById('output').textContent = r.output || 'No output.';

    // IR tab — syntax highlighted
    const irEl = document.getElementById('ir');
    if (r.ir) {
      irEl.innerHTML = highlightIR(r.ir);
    } else if (r.stages?.lex?.success === false) {
      irEl.innerHTML = '<span style="color:#888">Lexer errors prevented code generation. Fix the errors first.</span>';
    } else {
      irEl.innerHTML = '<span style="color:#888">No IR generated. Code may have errors.</span>';
    }

    // Diagnostics tab
    const diagEl = document.getElementById('diag');
    if (r.diagnostics && r.diagnostics.length > 0) {
      diagEl.innerHTML = r.diagnostics.map(d => {
        const cls = d.kind === 'error' ? 'diag-error' : 'diag-warn';
        return `<div class="diag-item ${cls}"><b>[${d.code}]</b> line ${d.line}:${d.col} — ${escapeHtml(d.message)}</div>`;
      }).join('');
    } else if (r.success) {
      diagEl.innerHTML = '<span style="color:#4ecca3">No diagnostics — clean compilation.</span>';
    } else {
      diagEl.innerHTML = '<span style="color:#888">No diagnostics available.</span>';
    }

    // Tokens tab
    const tokensEl = document.getElementById('tokens');
    if (r.tokens && r.tokens.length > 0) {
      tokensEl.innerHTML = r.tokens.map(t => `<span style="color:#888">${escapeHtml(t)}</span>`).join('\n');
    } else {
      tokensEl.innerHTML = '<span style="color:#888">Token stream not available. Run with --emit-tokens on the server.</span>';
    }

    // Contracts tab
    const contractsEl = document.getElementById('contracts');
    if (r.contracts) {
      contractsEl.textContent = r.contracts;
    } else if (source.includes('requires:') || source.includes('ensures:')) {
      contractsEl.innerHTML = '<span style="color:#ffd700">Contracts detected but verification not run. Check server support.</span>';
    } else {
      contractsEl.innerHTML = '<span style="color:#888">No contracts in this code. Add <code>requires:</code> or <code>ensures:</code> to see verification.</span>';
    }

    // Editor markers (diagnostics → squiggly underlines)
    if (window.editor && window.monaco) {
      monaco.editor.setModelMarkers(window.editor.getModel(), 'xiom', (r.diagnostics || []).filter(d => d.line > 0).map(d => ({
        severity: d.kind === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        message: d.message,
        startLineNumber: d.line,
        startColumn: d.col || 1,
        endLineNumber: d.line,
        endColumn: (d.col || 1) + 15,
      })));
    }

    status.textContent = r.success ? 'Compiled successfully.' : `Failed: ${(r.diagnostics||[]).filter(d=>d.kind==='error').length} error(s)`;
    status.className = r.success ? 'status-bar ok' : (r.diagnostics?.length ? 'status-bar err' : 'status-bar ok');

  } catch(e) {
    document.getElementById('output').textContent = 'Cannot reach compile server. Run: node server.js';
    status.textContent = 'Server not running.';
    status.className = 'status-bar err';
  }
}

function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function highlightIR(ir) {
  return escapeHtml(ir)
    .replace(/\b(define|declare|ret|br|call|load|store|alloca|getelementptr|icmp|fcmp|add|sub|mul|sdiv|srem|zext|sext|bitcast|inttoptr|ptrtoint|unreachable|switch|phi|select|fadd|fsub|fmul|fdiv)\b/g, '<span style="color:#ff79c6;font-weight:bold">$1</span>')
    .replace(/\b(i64|i32|i8|i16|double|float|void|i1|%struct\.\w+)\b/g, '<span style="color:#50fa7b">$1</span>')
    .replace(/\b(\d+)\b/g, '<span style="color:#bd93f9">$1</span>')
    .replace(/(%\w+)/g, '<span style="color:#8be9fd">$1</span>')
    .replace(/(@\w+)/g, '<span style="color:#f1fa8c">$1</span>');
}
