async function compile() {
  var source = window.editor.getValue();
  var status = document.getElementById('status');
  status.textContent = 'Compiling...';
  status.className = 'status-bar busy';

  try {
    var resp = await fetch('/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: source })
    });
    var result = await resp.json();

    document.getElementById('output').textContent = result.success ? 'Compilation successful!' : 'Compilation failed.';
    document.getElementById('ir').textContent = result.ir || 'No IR emitted.';
    document.getElementById('diag').innerHTML = (result.diagnostics || []).map(function (d) {
      return '<div class="diag-item diag-error"><b>[' + d.code + ']</b> line ' + d.line + ':' + d.col + ' \u2014 ' + d.message + '</div>';
    }).join('') || '<span style="color:#4ecca3">No diagnostics.</span>';

    status.textContent = result.success ? 'Compiled successfully.' : 'Failed: ' + (result.diagnostics || []).length + ' error(s)';
    status.className = result.success ? 'status-bar ok' : 'status-bar err';

    if (window.editor) {
      monaco.editor.setModelMarkers(window.editor.getModel(), 'xiom', (result.diagnostics || []).map(function (d) {
        return {
          severity: monaco.MarkerSeverity.Error,
          message: d.message,
          startLineNumber: Math.max(d.line || 1, 1),
          startColumn: Math.max(d.col || 1, 1),
          endLineNumber: Math.max(d.line || 1, 1),
          endColumn: Math.max(d.col || 1, 1) + 10,
        };
      }));
    }
  } catch (e) {
    document.getElementById('output').textContent = 'Error: ' + e.message;
    status.textContent = 'Cannot reach compile server.';
    status.className = 'status-bar err';
  }
}
