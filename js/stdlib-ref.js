// Copyright (c) 2026 Eleftherios Notas and XIOM Foundation
// SPDX-License-Identifier: MIT OR Apache-2.0
// XIOM Standard Library Reference - UI.
// Data is generated from the installed toolchain into js/stdlib-ref.json by
// tools/generate-stdlib-ref.js and loaded lazily the first time a panel opens.
// Modules carry a sandbox tier (playground / docs / local) and a docs URL.

var stdlibData = null;
var stdlibLoadPromise = null;

function loadStdlibData() {
  if (stdlibData) return Promise.resolve(stdlibData);
  if (!stdlibLoadPromise) {
    stdlibLoadPromise = fetch('js/stdlib-ref.json')
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (data) {
        stdlibData = data;
        return data;
      })
      .catch(function (err) {
        stdlibLoadPromise = null;
        throw err;
      });
  }
  return stdlibLoadPromise;
}

function stdlibCountsText(data) {
  return data.counts.modules + ' modules \u00B7 ' + data.counts.functions.toLocaleString('en-US') +
    ' functions \u00B7 XIOM ' + data.version;
}

function isDefaultVisible(mod) {
  return mod.tier === 'playground' && mod.name.indexOf('.') === -1;
}

function tierBadge(mod) {
  if (mod.tier === 'docs') return '<span class="tier-badge tier-docs" title="Documented module; not part of the default playground view">docs</span>';
  if (mod.tier === 'local') return '<span class="tier-badge tier-local" title="Needs the real compiler: download it from xiom-lang.org">local</span>';
  return '';
}

function docsLink(mod) {
  if (!mod.docs) return '';
  return '<a class="stdlib-docs-link" href="' + mod.docs + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">docs</a>';
}

function copyButton(sig) {
  return '<button class="stdlib-copy" data-sig="' + encodeURIComponent(sig) + '" title="Insert into the editor">+</button>';
}

function insertStdlibSnippet(sig) {
  var editor = window.editor;
  if (!editor) return;
  var parsed = window.xiomParseSignature ? window.xiomParseSignature(sig) : null;
  var name = parsed ? parsed.name : sig.split('(')[0].split('.').pop();
  var params = parsed ? parsed.params : [];
  var text = name + '(' + params.join(', ') + ')';

  var selection = editor.getSelection();
  editor.executeEdits('stdlib-insert', [{ range: selection, text: text, forceMoveMarkers: true }]);

  // Place the cursor inside the parentheses and preselect the first argument.
  var start = selection.getStartPosition();
  var openColumn = start.column + name.length + 1;
  var endColumn = openColumn + (params.length > 0 ? params[0].length : 0);
  editor.setSelection(new monaco.Selection(start.lineNumber, openColumn, start.lineNumber, endColumn));
  editor.focus();
}

function attachCopyButtons(container) {
  container.querySelectorAll('.stdlib-copy').forEach(function (btn) {
    btn.addEventListener('click', function (event) {
      event.stopPropagation();
      insertStdlibSnippet(decodeURIComponent(btn.getAttribute('data-sig')));
    });
  });
}

function toggleStdlibTiers(button) {
  var list = document.querySelector('.stdlib-modules');
  if (!list) return;
  var showAll = list.classList.toggle('show-all');
  button.textContent = showAll
    ? 'Show playground modules only'
    : 'Browse all ' + (stdlibData ? stdlibData.counts.modules : '') + ' modules';
}

function tierToggleButton(data) {
  return '<button class="stdlib-tier-toggle" onclick="toggleStdlibTiers(this)">Browse all ' +
    data.counts.modules + ' modules</button>';
}

// -- Syntax panel rendering (showStdlibRef) --
function showStdlibRef() {
  var container = document.querySelector('.syntax-content');
  var headerTitle = document.querySelector('.syntax-header h3');
  if (!container || !headerTitle) return;
  headerTitle.textContent = 'Standard Library';
  container.innerHTML = '<div class="stdlib-loading">Loading standard library...</div>';

  loadStdlibData().then(function (data) {
    var html = '<input type="text" class="concept-search" placeholder="Search all ' + data.counts.functions +
      ' functions..." oninput="filterStdlib(this.value)">';
    html += '<div class="stdlib-wasm-legend"><span class="wasm-badge wasm-full">* WASM</span> <span class="wasm-badge wasm-partial">[WARN] Limited</span> <span class="wasm-badge wasm-none">[FAIL] None</span></div>';
    html += '<div class="stdlib-modules">';
    data.modules.forEach(function (mod) {
      var w = mod.wasm || '*';
      html += '<div class="stdlib-module' + (isDefaultVisible(mod) ? '' : ' tier-hidden') + '" data-stdlib-module="' + mod.name + '">';
      html += '<div class="stdlib-module-header" onclick="this.parentElement.classList.toggle(\'collapsed\')">';
      html += '<span class="stdlib-module-arrow">v</span>';
      html += '<span class="stdlib-module-name">' + mod.name + '</span>';
      html += tierBadge(mod);
      html += '<span class="wasm-badge wasm-' + (w === '*' ? 'full' : w === '[WARN]' ? 'partial' : 'none') + '">' + w + '</span>';
      html += '<span class="stdlib-module-desc">' + esc(mod.desc || '') + '</span>';
      html += docsLink(mod);
      html += '</div>';
      html += '<div class="stdlib-module-fns">';
      (mod.functions || []).forEach(function (fn) {
        var fw = fn.wasm || w;
        html += '<div class="stdlib-fn" data-stdlib-search="' + mod.name + ' ' + fn.sig.toLowerCase() + ' ' + (fn.desc || '').toLowerCase() + '">';
        html += '<code>' + esc(fn.sig) + '</code>';
        html += '<span class="wasm-badge wasm-' + (fw === '*' ? 'full' : fw === '[WARN]' ? 'partial' : 'none') + '" title="WASM: ' + (fw === '*' ? 'Full' : fw === '[WARN]' ? 'Limited' : 'Unavailable') + '">' + fw + '</span>';
        html += '<span class="stdlib-fn-desc">' + esc(fn.desc || '') + '</span>';
        html += copyButton(fn.sig);
        html += '</div>';
      });
      html += '</div></div>';
    });
    html += '</div>';
    html += '<div class="stdlib-footer">' + stdlibCountsText(data) + '</div>';
    container.innerHTML = html;
    attachCopyButtons(container);
  }).catch(function () {
    container.innerHTML = '<div class="stdlib-loading">Standard library reference is unavailable.</div>';
  });
}

function filterStdlib(query) {
  var q = query.toLowerCase().trim();
  var list = document.querySelector('.stdlib-modules');
  if (list) list.classList.toggle('searching', q !== '');
  document.querySelectorAll('.stdlib-fn').forEach(function (el) {
    el.style.display = (q === '' || (el.getAttribute('data-stdlib-search') || '').indexOf(q) >= 0) ? '' : 'none';
  });
  document.querySelectorAll('.stdlib-module').forEach(function (mod) {
    if (q === '') { mod.style.display = ''; return; }
    var any = mod.querySelectorAll('.stdlib-fn:not([style*="display: none"])').length > 0;
    mod.style.display = any ? '' : 'none';
  });
}

function hideStdlibRef() {
  if (window.populateSyntaxPanel) window.populateSyntaxPanel();
  var t = document.querySelector('.syntax-header h3');
  if (t) t.textContent = 'Concepts';
}

// -- Persistent panel rendering (showStdlibPanel) --
function showStdlibPanel() {
  var container = document.getElementById('stdlibPanelContent');
  if (!container) return;
  container.innerHTML = '<div class="stdlib-loading">Loading standard library...</div>';

  loadStdlibData().then(function (data) {
    var html = '';

    html += '<div class="stdlib-hero">';
    html += '<input type="text" class="stdlib-search" placeholder="Search all ' + data.counts.functions +
      ' functions..." oninput="filterStdlibPanel(this.value)">';
    html += '<div class="stdlib-quick-chips">';
    var quickChips = ['io.println', 'to_string', 'Vec.push', 'match', 'println', 'hashset'];
    quickChips.forEach(function (label) {
      html += '<span class="stdlib-chip" onclick="filterStdlibPanel(\'' + label + '\'); var s = document.querySelector(\'.stdlib-search\'); if(s) s.value=\'' + label + '\';" title="Search ' + label + '">' + label + '</span>';
    });
    html += '</div>';
    html += '<div class="stdlib-tier-bar">' + tierToggleButton(data) +
      '<span class="stdlib-tier-hint">Default view: modules you can use in the sandbox and lessons. ' +
      '<a class="stdlib-docs-link" href="https://xiom-lang.org" target="_blank" rel="noopener">Download the compiler</a> for OS, memory, and network modules.</span></div>';
    html += '</div>';

    html += '<div class="stdlib-modules">';
    data.modules.forEach(function (mod) {
      var functions = mod.functions || [];
      html += '<div class="stdlib-mod-card' + (isDefaultVisible(mod) ? '' : ' tier-hidden') + '" data-stdlib-module="' + mod.name + '" data-tier="' + mod.tier + '">';
      html += '<div class="stdlib-mod-card-header" onclick="this.parentElement.classList.toggle(\'open\')">';
      html += '<div class="stdlib-mod-card-left">';
      html += '<span class="stdlib-mod-card-arrow">></span>';
      html += '<span class="stdlib-mod-card-name">' + esc(mod.name) + '</span>';
      html += tierBadge(mod);
      html += '<span class="stdlib-mod-card-badge">' + functions.length + '</span>';
      html += '</div>';
      html += '<span class="stdlib-mod-card-desc">' + esc(mod.desc || '') + '</span>';
      html += docsLink(mod);
      html += '</div>';
      html += '<div class="stdlib-mod-card-body">';
      functions.forEach(function (fn) {
        html += '<div class="stdlib-fn-row" data-stdlib-search="' + mod.name + ' ' + fn.sig.toLowerCase() + ' ' + (fn.desc || '').toLowerCase() + '" id="stdlib-fn-' + mod.name.replace(/[^a-zA-Z0-9]/g, '-') + '-' + fn.sig.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30) + '">';
        html += '<code>' + esc(fn.sig) + '</code>';
        html += '<span>' + esc(fn.desc || '') + '</span>';
        html += copyButton(fn.sig);
        html += '</div>';
      });
      html += '</div></div>';
    });
    html += '</div>';

    html += '<div class="stdlib-footer">' + stdlibCountsText(data) + '</div>';
    container.innerHTML = html;
    attachCopyButtons(container);
  }).catch(function () {
    container.innerHTML = '<div class="stdlib-loading">Standard library reference is unavailable.</div>';
  });
}

function filterStdlibPanel(query) {
  var q = query.toLowerCase().trim();
  var panel = document.getElementById('stdlibPanel');
  if (!panel) return;

  var list = panel.querySelector('.stdlib-modules');
  if (list) list.classList.toggle('searching', q !== '');

  panel.querySelectorAll('.stdlib-fn-row').forEach(function (row) {
    var text = (row.getAttribute('data-stdlib-search') || '').toLowerCase();
    row.style.display = (q === '' || text.indexOf(q) >= 0) ? '' : 'none';
  });
  panel.querySelectorAll('.stdlib-mod-card').forEach(function (mod) {
    if (q === '') { mod.style.display = ''; return; }
    var any = Array.from(mod.querySelectorAll('.stdlib-fn-row')).some(function (r) { return r.style.display !== 'none'; });
    mod.style.display = any ? '' : 'none';
  });
}

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

window.showStdlibRef = showStdlibRef;
window.filterStdlib = filterStdlib;
window.hideStdlibRef = hideStdlibRef;
window.showStdlibPanel = showStdlibPanel;
window.filterStdlibPanel = filterStdlibPanel;
window.insertStdlibSnippet = insertStdlibSnippet;
window.toggleStdlibTiers = toggleStdlibTiers;
