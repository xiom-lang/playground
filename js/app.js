var currentMode = 'landing';
var currentLessonId = null;
var currentLessonFile = null;
var currentLessonData = null;
var lessonCatalogCache = null;
var syntaxVisible = false;

function showLanding() {
  currentMode = 'landing';
  document.getElementById('landing').classList.remove('hidden');
  document.getElementById('lessonsScreen').classList.add('hidden');
  document.getElementById('playgroundScreen').classList.add('hidden');
}

function startLearning() {
  currentMode = 'lessons';
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('playgroundScreen').classList.add('hidden');
  document.getElementById('lessonsScreen').classList.remove('hidden');
  if (window.loadLessonCatalog) {
    window.loadLessonCatalog();
  }
}

function openPlayground() {
  currentMode = 'playground';
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('lessonsScreen').classList.add('hidden');
  document.getElementById('playgroundScreen').classList.remove('hidden');
  initPlaygroundEditor();
}

function toggleSyntax() {
  syntaxVisible = !syntaxVisible;
  var panel = document.getElementById('syntaxPanel');
  panel.classList.toggle('hidden', !syntaxVisible);
  if (syntaxVisible) {
    populateSyntaxPanel();
  }
}

function formatCode() {
  var source = getActiveEditorValue();
  if (!source) return;

  var statusEl = currentMode === 'playground' ? document.getElementById('pgStatus') : document.getElementById('status');
  statusEl.textContent = 'Formatting...';
  statusEl.className = 'status-bar busy';

  fetch('/api/format', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: source })
  })
    .then(function (resp) { return resp.json(); })
    .then(function (r) {
      if (r.formatted) {
        var ed = getActiveEditor();
        if (ed) ed.setValue(r.formatted);
        statusEl.textContent = 'Formatted.';
        statusEl.className = 'status-bar ok';
      } else {
        statusEl.textContent = 'Format failed: ' + (r.error || 'unknown error');
        statusEl.className = 'status-bar err';
      }
    })
    .catch(function () {
      statusEl.textContent = 'Format server unavailable.';
      statusEl.className = 'status-bar err';
    });
}

function nextLesson() {
  if (!currentLessonData || !currentLessonData.next_lesson) return;
  findAndSelectLesson(currentLessonData.next_lesson);
}

function findAndSelectLesson(lessonId) {
  if (!lessonCatalogCache) return;

  var found = null;
  lessonCatalogCache.levels.forEach(function (level) {
    level.lessons.forEach(function (lesson) {
      if (lesson.id === lessonId) found = lesson;
    });
  });

  if (found && window.selectLesson) {
    window.selectLesson(found.id, found.file);
    document.getElementById('completionBar').classList.add('hidden');
  }
}

function loadFirstLesson() {
  if (!lessonCatalogCache) return;
  var firstLevel = lessonCatalogCache.levels[0];
  if (firstLevel && firstLevel.lessons.length > 0) {
    var first = firstLevel.lessons[0];
    if (window.selectLesson) {
      window.selectLesson(first.id, first.file);
    }
  }
}

function showCompletionBar() {
  document.getElementById('completionBar').classList.remove('hidden');
}

function updateLineCount() {
  var ed = getActiveEditor();
  if (!ed) return;
  var pos = ed.getPosition();
  var elId = currentMode === 'playground' ? 'pgLineCol' : 'lineCol';
  var el = document.getElementById(elId);
  if (el && pos) {
    el.textContent = 'Ln ' + pos.lineNumber + ', Col ' + pos.column;
  }
}

function getActiveEditor() {
  if (currentMode === 'playground') return window.pgEditor || null;
  return window.editor || null;
}

function getActiveEditorValue() {
  var ed = getActiveEditor();
  return ed ? ed.getValue() : '';
}

function getActiveOutputIds() {
  if (currentMode === 'playground') {
    return {
      output: 'pgOutput',
      ir: 'pgIR',
      diag: 'pgDiag',
      tokens: 'pgTokens',
      contracts: 'pgContracts',
      status: 'pgStatus'
    };
  }
  return {
    output: 'output',
    ir: 'ir',
    diag: 'diag',
    tokens: 'tokens',
    contracts: 'contracts',
    status: 'status'
  };
}

// ========== TAB SWITCHING ==========
function setupTabs() {
  document.querySelectorAll('.output-tabs').forEach(function (tabBar) {
    tabBar.addEventListener('click', function (e) {
      var tab = e.target.closest('.tab');
      if (!tab) return;
      var parent = tab.closest('.output-tabs');
      parent.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
      tab.classList.add('active');

      var tabName = tab.dataset.tab;
      var outputEl = parent.nextElementSibling;
      if (!outputEl) return;
      var ids = currentMode === 'playground'
        ? { output: 'pgOutput', ir: 'pgIR', diag: 'pgDiag', tokens: 'pgTokens', contracts: 'pgContracts' }
        : { output: 'output', ir: 'ir', diag: 'diag', tokens: 'tokens', contracts: 'contracts' };

      Object.keys(ids).forEach(function (key) {
        var el = document.getElementById(ids[key]);
        if (el) el.classList.toggle('hidden', key !== tabName);
      });
    });
  });
}

// ========== KEYBOARD SHORTCUTS ==========
document.addEventListener('keydown', function (e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    if (currentMode !== 'landing' && window.compile) window.compile();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    toggleSyntax();
  }
  if (e.key === 'Escape') {
    if (syntaxVisible) toggleSyntax();
  }
});

window.addEventListener('load', function () {
  setupTabs();
  if (window.loadLessonCatalog) window.loadLessonCatalog();
});
